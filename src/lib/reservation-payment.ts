import type Stripe from "stripe";
import { getRequiredEnv } from "./env";
import { database, optionalEnv, reservationMode, rpc } from "./reservations";
import { getEsVatRate } from "./stripe-tax";
import { SHIRT_FINAL_PRICE_CENTS } from "../config/commerce";

export function assertShirtSalesEnabled() {
  if (reservationMode()) throw new Error("RESERVATION_MODE");
  if (optionalEnv("SHIRT_SALES_APPROVED") !== "true")
    throw new Error("PRODUCT_REVIEW_REQUIRED");
  const key = getRequiredEnv("STRIPE_SECRET_KEY");
  if (!/^(sk|rk)_(test|live)_/.test(key))
    throw new Error("INVALID_STRIPE_MODE");
  if (
    /^(sk|rk)_live_/.test(key) &&
    optionalEnv("STRIPE_LIVE_CHECKOUT_ENABLED") !== "true"
  )
    throw new Error("LIVE_CHECKOUT_NOT_ENABLED");
}
export async function shirtPaymentConfiguration() {
  assertShirtSalesEnabled();
  const { stripe } = await import("./stripe");
  const price = await stripe.prices.retrieve(
    getRequiredEnv("STRIPE_PRICE_CAMISETA_IMPERIAL"),
  );
  const live = /^(sk|rk)_live_/.test(getRequiredEnv("STRIPE_SECRET_KEY"));
  if (
    !price.active ||
    price.type !== "one_time" ||
    price.currency !== "eur" ||
    price.unit_amount !== SHIRT_FINAL_PRICE_CENTS ||
    price.livemode !== live ||
    price.tax_behavior === "exclusive"
  )
    throw new Error("PRICE_CONFIGURATION_REQUIRED");
  const tax = await getEsVatRate(stripe, live);
  if (!tax) throw new Error("TAX_CONFIGURATION_REQUIRED");
  return { stripe, price, tax };
}
export async function handleReservationCheckout(
  session: Stripe.Checkout.Session,
) {
  const attempt = session.metadata?.reservationAttemptId;
  if (!attempt || session.mode !== "payment") return false;
  if (session.payment_status !== "paid" || session.status !== "complete")
    return true;
  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (
    !intent ||
    session.total_details?.amount_discount !== 0 ||
    (session.total_details?.amount_tax ?? 0) <= 0
  )
    throw new Error("PAYMENT_VALIDATION_FAILED");
  await rpc("complete_shirt_payment", {
    p_attempt: attempt,
    p_session: session.id,
    p_intent: intent,
    p_total: session.amount_total,
    p_currency: session.currency,
    p_tax: session.total_details?.amount_tax,
    p_shipping: session.total_details?.amount_shipping ?? 0,
  });
  return true;
}
export async function recordPaymentSession(
  attemptId: string,
  sessionId: string,
) {
  const { error } = await (
    await database()
  )
    .from("reservation_payment_attempts")
    .update({ stripe_session_id: sessionId })
    .eq("id", attemptId)
    .is("stripe_session_id", null);
  if (error) throw new Error("DATABASE_UNAVAILABLE");
}

export async function closeOpenReservationPayment(reservationId: string) {
  const { data: attempt, error } = await (
    await database()
  )
    .from("reservation_payment_attempts")
    .select("id,stripe_session_id")
    .eq("reservation_id", reservationId)
    .eq("status", "OPEN")
    .maybeSingle();
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  if (!attempt) return;
  if (!attempt.stripe_session_id) throw new Error("PAYMENT_IN_PROGRESS");
  const { stripe } = await import("./stripe");
  let session = await stripe.checkout.sessions.retrieve(
    attempt.stripe_session_id,
  );
  if (session.status === "open") {
    try {
      session = await stripe.checkout.sessions.expire(session.id);
    } catch {
      session = await stripe.checkout.sessions.retrieve(session.id);
    }
  }
  // Never release inventory if payment won the race; wait for its signed webhook.
  if (session.status !== "expired") throw new Error("PAYMENT_IN_PROGRESS");
  await rpc("close_shirt_payment", {
    p_attempt: attempt.id,
    p_session: session.id,
    p_expired: true,
  });
}
