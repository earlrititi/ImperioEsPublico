import type { APIRoute } from "astro";
import { SHIRT_FINAL_PRICE_CENTS, SHIRT_PRODUCT_PRICE_CENTS, shirtDeliveryOption } from "../../../../config/commerce";
import { LEGAL_DOCUMENT_VERSIONS } from "../../../../config/legal";
import { getRequiredEnv } from "../../../../lib/env";
import { isMainlandAddress } from "../../../../lib/reservation-validation";
import {
  authorizedReservation,
  database,
  failure,
  getUser,
  limited,
  privateJson,
  requestBody,
  rpc,
} from "../../../../lib/reservations";
import {
  assertShirtSalesEnabled,
  recordPaymentSession,
  shirtCheckoutPublishableKey,
  shirtPaymentConfiguration,
} from "../../../../lib/reservation-payment";
import { findActiveTshirtPromotion } from "../../../../lib/tshirt-promotion";
import { ownsShirtDiscount, shirtCheckoutLines, shirtCheckoutMessage } from "../../../../lib/shirt-checkout-lines";
import { BLACK_FRIDAY_CAMPAIGN, blackFridayDiscount, blackFridayEligible } from "../../../../config/black-friday";
import { blackFridayCoupon } from "../../../../lib/black-friday-coupon";
import { captureAutomationActivity } from "../../../../lib/automation-worker";
export const prerender = false;
export const POST: APIRoute = async (context) => {
  try {
    // No Stripe import or creation is reachable in reservation mode.
    assertShirtSalesEnabled();
    const body = await requestBody(context.request);
    await limited(context.request, "reservation_checkout", 20);
    if (body.confirmPurchase !== true || !isMainlandAddress(body.address))
      throw new Error("INVALID_INPUT");
    const requestedDelivery = shirtDeliveryOption(body.delivery);
    if (body.delivery !== undefined && !requestedDelivery) throw new Error("INVALID_INPUT");
    if (body.paymentUi !== undefined && body.paymentUi !== "elements") throw new Error("INVALID_INPUT");
    const r = await authorizedReservation(
      context,
      context.params.id ?? "",
      body.token,
    );
    if (
      r.reservation_items.some(
        (i: any) => i.unit_price_snapshot !== SHIRT_FINAL_PRICE_CENTS,
      ) ||
      r.total_price_snapshot !==
        r.reservation_items.reduce(
          (n: number, i: any) => n + i.quantity * SHIRT_FINAL_PRICE_CENTS,
          0,
        )
    )
      throw new Error("PRICE_CONFIGURATION_REQUIRED");
    const { stripe, price, tax } = await shirtPaymentConfiguration();
    const customer = body.customer ?? { name: r.customer_name, email: r.customer_email };
    if (typeof customer.name !== "string" || customer.name.trim().length < 2 || customer.name.length > 150 ||
      typeof customer.email !== "string" || customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()))
      throw new Error("INVALID_CUSTOMER");
    const attemptId = await rpc("begin_shirt_payment", {
      p_id: r.id,
      p_address: body.address,
      p_terms: LEGAL_DOCUMENT_VERSIONS.terms,
      p_customer: { name: customer.name.trim(), email: customer.email.trim().toLowerCase() },
      ...(requestedDelivery ? { p_shipping_method: requestedDelivery.id } : {}),
    });
    const { data: a, error } = await (
      await database()
    )
      .from("reservation_payment_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
    if (error || !a) throw new Error("DATABASE_UNAVAILABLE");
    const delivery = shirtDeliveryOption(a.shipping_method);
    if ((a.shipping_method && !delivery) || (requestedDelivery && delivery?.id !== requestedDelivery.id) ||
      (delivery && a.shipping_amount !== delivery.amount)) throw new Error("PAYMENT_SHIPPING_LOCKED");
    const subtotal = delivery
      ? SHIRT_PRODUCT_PRICE_CENTS * r.total_quantity + delivery.amount
      : r.total_price_snapshot;
    const elements = body.paymentUi === "elements" && Boolean(shirtCheckoutPublishableKey());
    const site = getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
    const metadata = {
      reservationAttemptId: attemptId,
      reservation_id: r.id,
      reservation_code: r.number,
      product_sku: r.reservation_items.map((i: any) => i.sku).join(","),
      size: r.reservation_items.map((i: any) => i.size).join(","),
      quantity: String(r.total_quantity),
      ...(delivery ? { shirt_delivery: delivery.id } : {}),
    };
    const user = await getUser(context);
    const promotion = a.stripe_session_id || !ownsShirtDiscount(user,r.customer_email,customer.email)
      ? null : await findActiveTshirtPromotion(user!.email!.trim().toLowerCase());
    const bfEligible = blackFridayEligible(a.created_at, delivery?.id);
    // Existing subscriber benefits (15% or 20%) are greater than EUR 4 per shirt. Never stack.
    const bfCoupon = !a.stripe_session_id && !promotion && bfEligible
      ? await blackFridayCoupon(stripe, typeof price.product === "string" ? price.product : price.product.id, r.total_quantity, price.livemode)
      : null;
    const session = a.stripe_session_id
      ? await stripe.checkout.sessions.retrieve(a.stripe_session_id)
      : await stripe.checkout.sessions.create(
          {
            mode: "payment",
            locale: "es",
            payment_method_types: ["card"],
            customer_creation: "if_required",
            customer_email: customer.email.trim().toLowerCase(),
            line_items: shirtCheckoutLines(price.id,tax.id,r.reservation_items,delivery?.id),
            automatic_tax: { enabled: false },
            adaptive_pricing: { enabled: false },
            discounts: promotion ? [{ promotion_code: promotion.promotionCodeId }] : bfCoupon ? [{ coupon: bfCoupon }] : undefined,
            metadata: { ...metadata, promotionLeadId: promotion?.leadId ?? "", ...(bfCoupon ? { campaign: BLACK_FRIDAY_CAMPAIGN, discount_kind: "black_friday" } : {}) },
            payment_intent_data: {
              metadata: { ...metadata, ...(bfCoupon ? { campaign: BLACK_FRIDAY_CAMPAIGN, discount_kind: "black_friday" } : {}) },
            },
            expires_at: Math.floor(new Date(a.expires_at).getTime() / 1000),
            ...(elements ? {
              ui_mode: "elements",
              return_url: `${site}/compra/completada`,
            } : {
              success_url: `${site}/compra/completada`,
              cancel_url: `${site}/reservas/gestionar`,
              custom_text: { submit: { message: shirtCheckoutMessage(r.reservation_items, delivery?.id) } },
            }),
          },
          { idempotencyKey: `reservation-payment-${attemptId}` },
        );
    const discountAmount = session.total_details?.amount_discount ?? 0;
    const promotionLeadId = a.promotion_lead_id ?? promotion?.leadId ?? (session.metadata?.promotionLeadId || null);
    const bfApplied = session.metadata?.campaign === BLACK_FRIDAY_CAMPAIGN && session.metadata?.discount_kind === "black_friday";
    if (bfApplied && (!bfEligible || promotionLeadId || discountAmount !== blackFridayDiscount(r.total_quantity)))
      throw new Error("PAYMENT_TOTAL_MISMATCH");
    if (bfCoupon && !bfApplied) throw new Error("PAYMENT_TOTAL_MISMATCH");
    if (promotion && (discountAmount <= 0 || session.amount_total === null || session.amount_total + discountAmount !== subtotal))
      throw new Error("PAYMENT_TOTAL_MISMATCH");
    if (!promotionLeadId && !bfApplied && discountAmount !== 0) throw new Error("PAYMENT_TOTAL_MISMATCH");
    if (session.amount_total === null || session.amount_total + discountAmount !== subtotal ||
      (delivery && session.metadata?.shirt_delivery !== delivery.id)) throw new Error("PAYMENT_TOTAL_MISMATCH");
    await recordPaymentSession(attemptId, session.id, session.amount_total, discountAmount, promotionLeadId);
    if (session.status === "expired") {
      await rpc("close_shirt_payment", {
        p_attempt: attemptId,
        p_session: session.id,
        p_expired: true,
      });
      return privateJson(
        {
          error:
            "La sesion ha caducado. Revisa los datos y vuelve a confirmar el pago.",
        },
        409,
      );
    }
    if (session.status === "complete")
      return privateJson(
        {
          error:
            "El pago esta en proceso de confirmacion. Consulta el estado de tu reserva.",
        },
        409,
      );
    if (!session.url && !session.client_secret) throw new Error("PAYMENT_IN_PROGRESS");
    if (user?.email_confirmed_at && user.email?.toLowerCase() === customer.email.trim().toLowerCase()) {
      await captureAutomationActivity(user.id, "checkout").catch(() => {});
    }
    if (session.url) return privateJson({ url: session.url });
    if (elements && session.client_secret) return privateJson({ clientSecret: session.client_secret, total: session.amount_total, discount: discountAmount });
    throw new Error("PAYMENT_IN_PROGRESS");
  } catch (error) {
    return failure(error);
  }
};
