import type { APIRoute } from "astro";
import { SHIRT_FINAL_PRICE_CENTS } from "../../../../config/commerce";
import { LEGAL_DOCUMENT_VERSIONS } from "../../../../config/legal";
import { getRequiredEnv } from "../../../../lib/env";
import { isMainlandAddress } from "../../../../lib/reservation-validation";
import {
  authorizedReservation,
  database,
  failure,
  limited,
  privateJson,
  requestBody,
  rpc,
} from "../../../../lib/reservations";
import {
  assertShirtSalesEnabled,
  recordPaymentSession,
  shirtPaymentConfiguration,
} from "../../../../lib/reservation-payment";
export const prerender = false;
export const POST: APIRoute = async (context) => {
  try {
    // No Stripe import or creation is reachable in reservation mode.
    assertShirtSalesEnabled();
    const body = await requestBody(context.request);
    await limited(context.request, "reservation_checkout", 20);
    if (body.confirmPurchase !== true || !isMainlandAddress(body.address))
      throw new Error("INVALID_INPUT");
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
    });
    const { data: a, error } = await (
      await database()
    )
      .from("reservation_payment_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();
    if (error || !a) throw new Error("DATABASE_UNAVAILABLE");
    const site = getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
    const metadata = {
      reservationAttemptId: attemptId,
      reservation_id: r.id,
      reservation_code: r.number,
      product_sku: r.reservation_items.map((i: any) => i.sku).join(","),
      size: r.reservation_items.map((i: any) => i.size).join(","),
      quantity: String(r.total_quantity),
    };
    const session = a.stripe_session_id
      ? await stripe.checkout.sessions.retrieve(a.stripe_session_id)
      : await stripe.checkout.sessions.create(
          {
            mode: "payment",
            locale: "es",
            payment_method_types: ["card"],
            customer_creation: "if_required",
            customer_email: customer.email.trim().toLowerCase(),
            line_items: r.reservation_items.map((i: any) => ({
              price: price.id,
              quantity: i.quantity,
              tax_rates: [tax.id],
            })),
            automatic_tax: { enabled: false },
            adaptive_pricing: { enabled: false },
            allow_promotion_codes: false,
            metadata,
            payment_intent_data: {
              metadata,
            },
            expires_at: Math.floor(new Date(a.expires_at).getTime() / 1000),
            success_url: `${site}/compra/completada`,
            cancel_url: `${site}/reservas/gestionar`,
            custom_text: {
              submit: {
                message:
                  "IVA incluido. Envio estandar a Espana peninsular incluido. Se utilizara la direccion confirmada en tu reserva.",
              },
            },
          },
          { idempotencyKey: `reservation-payment-${attemptId}` },
        );
    await recordPaymentSession(attemptId, session.id);
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
    if (!session.url || session.amount_total !== r.total_price_snapshot)
      throw new Error("PAYMENT_TOTAL_MISMATCH");
    return privateJson({ url: session.url });
  } catch (error) {
    return failure(error);
  }
};
