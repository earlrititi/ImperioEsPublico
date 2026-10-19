import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { subscriptionPurchaseItem, type GooglePurchase } from "./ecommerce";
import { checkoutPlans, getCheckoutPlan, isCheckoutPriceValid, type CheckoutPlan } from "./stripe-prices";

const id = (object: string | { id: string } | null | undefined) => typeof object === "string" ? object : object?.id;
const fresh = (timestamp: number | null | undefined, now: number) => typeof timestamp === "number" &&
  Number.isSafeInteger(timestamp) && timestamp <= now && now - timestamp <= 24 * 60 * 60;

export function confirmedSubscriptionPurchase(input: {
  session: Stripe.Checkout.Session; subscription: Stripe.Subscription; invoice: Stripe.Invoice;
  price: Stripe.Price; payment: Stripe.InvoicePayment; intent: Stripe.PaymentIntent; charge: Stripe.Charge;
  variant: CheckoutPlan; expectedPriceId: string;
}, now = Math.floor(Date.now() / 1000)): GooglePurchase | null {
  const { session: s, subscription: sub, invoice: inv, price, payment, intent, charge } = input;
  const plan = Object.hasOwn(checkoutPlans, input.variant) ? checkoutPlans[input.variant] : null;
  const taxes = inv.total_taxes;
  const line = inv.lines?.data[0];
  if (!plan || !/^cs_live_[A-Za-z0-9]+$/.test(s.id) ||
    ![s, sub, inv, price, payment, intent, charge].every(o => o.livemode === true) ||
    s.mode !== "subscription" || s.status !== "complete" || s.payment_status !== "paid" || !fresh(s.created, now) ||
    id(s.subscription) !== sub.id || id(s.invoice) !== inv.id || sub.status !== "active" ||
    id(s.customer) !== id(sub.customer) || !id(s.customer) || id(inv.customer) !== id(s.customer) ||
    id(inv.parent?.subscription_details?.subscription) !== sub.id ||
    inv.status !== "paid" || inv.billing_reason !== "subscription_create" || !fresh(inv.status_transitions.paid_at, now) ||
    inv.currency !== "eur" || s.currency !== "eur" || inv.total !== plan.expectedUnitAmount ||
    inv.amount_paid !== inv.total || inv.amount_remaining !== 0 || s.amount_total !== inv.total ||
    inv.starting_balance !== 0 || inv.ending_balance !== 0 ||
    inv.post_payment_credit_notes_amount !== 0 || inv.pre_payment_credit_notes_amount !== 0 ||
    !isCheckoutPriceValid(price, plan) || price.id !== input.expectedPriceId ||
    sub.metadata.plan !== plan.plan || sub.metadata.billingInterval !== plan.billingInterval ||
    inv.lines.has_more || inv.lines.data.length !== 1 || line?.quantity !== 1 ||
    line.pricing?.price_details?.price !== price.id || line.amount !== inv.total ||
    !Array.isArray(taxes) || !taxes.length || taxes.some(t => !Number.isSafeInteger(t.amount) || t.amount < 0) ||
    payment.status !== "paid" || id(payment.invoice) !== inv.id || payment.currency !== "eur" ||
    payment.amount_paid !== inv.total || payment.payment.type !== "payment_intent" || id(payment.payment.payment_intent) !== intent.id ||
    intent.status !== "succeeded" || intent.currency !== "eur" || intent.amount_received !== inv.total ||
    id(intent.customer) !== id(s.customer) || id(intent.latest_charge) !== charge.id ||
    id(charge.payment_intent) !== intent.id || id(charge.customer) !== id(s.customer) ||
    !charge.paid || !charge.captured || charge.status !== "succeeded" || charge.refunded || charge.amount_refunded !== 0 ||
    charge.disputed || charge.currency !== "eur" || charge.amount !== inv.total) return null;
  const tax = taxes.reduce((sum, t) => sum + t.amount, 0);
  const value = inv.total - tax;
  if (tax <= 0 || value <= 0 || inv.total_excluding_tax !== value) return null;
  const item = subscriptionPurchaseItem(input.variant, value / 100);
  if (!item) return null;
  // Only an actual initial invoice payment is a purchase; account access and
  // recurring renewals must not turn success-page visits into extra revenue.
  return { transaction_id: `ie_${createHash("sha256").update(`subscription-invoice:${inv.id}`).digest("hex")}`,
    currency: "EUR", value: value / 100, tax: tax / 100, shipping: 0, items: [item] };
}

export async function subscriptionPurchaseReceipt(stripe: Stripe, sessionId: string): Promise<GooglePurchase | null> {
  if (!/^cs_live_[A-Za-z0-9]{1,190}$/.test(sessionId)) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["invoice", "subscription"] });
  if (!session.livemode || session.payment_status !== "paid" || session.mode !== "subscription" ||
    !fresh(session.created, Math.floor(Date.now() / 1000)) ||
    !session.invoice || typeof session.invoice === "string" ||
    !session.subscription || typeof session.subscription === "string") return null;
  const subscription = session.subscription;
  const variant = `${subscription.metadata.plan === "maestre_campo" ? "maestre-campo" : subscription.metadata.plan}-${subscription.metadata.billingInterval === "year" ? "annual" : "monthly"}` as CheckoutPlan;
  const plan = getCheckoutPlan(variant);
  if (!plan) return null;
  const price = await stripe.prices.retrieve(plan.priceId);
  const payments = await stripe.invoicePayments.list({ invoice: session.invoice.id, status: "paid", limit: 2 });
  if (payments.has_more || payments.data.length !== 1) return null;
  const payment = payments.data[0];
  const intentId = id(payment.payment.payment_intent);
  if (payment.payment.type !== "payment_intent" || !intentId) return null;
  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  if (!intent.latest_charge || typeof intent.latest_charge === "string") return null;
  return confirmedSubscriptionPurchase({ session, subscription, invoice: session.invoice,
    price, payment, intent, charge: intent.latest_charge, variant, expectedPriceId: plan.priceId });
}
