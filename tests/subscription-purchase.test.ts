import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { confirmedSubscriptionPurchase, subscriptionPurchaseReceipt } from "../src/lib/subscription-purchase";
import { googlePurchasePayload } from "../src/lib/ecommerce";
import { checkoutPlans, type CheckoutPlan } from "../src/lib/stripe-prices";

function evidence(variant: CheckoutPlan = "maestre-campo-annual") {
  const plan = checkoutPlans[variant], total = plan.expectedUnitAmount;
  const tax = total - Math.round(total / 1.21), now = Math.floor(Date.now() / 1000);
  return { variant, expectedPriceId: "price_fixture",
    session: { id: "cs_live_fixture", livemode: true, mode: "subscription", status: "complete", payment_status: "paid",
      created: now, subscription: "sub_fixture", invoice: "in_fixture", customer: "cus_fixture", currency: "eur", amount_total: total },
    subscription: { id: "sub_fixture", livemode: true, status: "active", customer: "cus_fixture",
      metadata: { plan: plan.plan, billingInterval: plan.billingInterval } },
    invoice: { id: "in_fixture", livemode: true, customer: "cus_fixture", status: "paid", billing_reason: "subscription_create",
      parent: { subscription_details: { subscription: "sub_fixture" } }, status_transitions: { paid_at: now },
      currency: "eur", total, amount_paid: total, amount_remaining: 0, total_excluding_tax: total - tax,
      starting_balance: 0, ending_balance: 0, pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0,
      total_taxes: [{ amount: tax }], lines: { has_more: false, data: [{ quantity: 1, amount: total, pricing: { price_details: { price: "price_fixture" } } }] } },
    price: { id: "price_fixture", livemode: true, active: true, currency: "eur", type: "recurring", unit_amount: total,
      recurring: { interval: plan.billingInterval, interval_count: 1 } },
    payment: { livemode: true, status: "paid", invoice: "in_fixture", currency: "eur", amount_paid: total,
      payment: { type: "payment_intent", payment_intent: "pi_fixture" } },
    intent: { id: "pi_fixture", livemode: true, status: "succeeded", currency: "eur", amount_received: total,
      customer: "cus_fixture", latest_charge: "ch_fixture" },
    charge: { id: "ch_fixture", livemode: true, payment_intent: "pi_fixture", customer: "cus_fixture", currency: "eur",
      status: "succeeded", paid: true, captured: true, refunded: false, amount_refunded: 0, disputed: false, amount: total },
  };
}
const receipt = (e: ReturnType<typeof evidence>) => confirmedSubscriptionPurchase(e as unknown as Parameters<typeof confirmedSubscriptionPurchase>[0]);

test("four initial subscription invoices reconcile actual tax and have stable, non-personal receipts", () => {
  for (const variant of Object.keys(checkoutPlans) as CheckoutPlan[]) {
    const e = evidence(variant), p = receipt(e)!;
    assert.ok(p); assert.deepEqual(receipt(e), p);
    assert.equal(Math.round((p.value + p.tax) * 100), e.invoice.total);
    assert.equal(p.items[0].item_variant, variant); assert.equal(p.items[0].quantity, 1);
    assert.equal(p.items[0].price, p.value); assert.equal(p.shipping, 0);
    assert.deepEqual(googlePurchasePayload(p), p);
    assert.doesNotMatch(JSON.stringify(p), /cus_fixture|in_fixture|sub_fixture|pi_fixture|ch_fixture|cs_live/);
  }
});

test("subscription access, renewals, unpaid, refunded, Test and mismatched payments never count as purchases", () => {
  const mutations: ((e: any) => void)[] = [
    e => { e.session.status = "open"; }, e => { e.session.payment_status = "unpaid"; },
    e => { e.session.mode = "payment"; }, e => { e.session.id = "cs_test_fixture"; },
    e => { e.session.created -= 25 * 3600; }, e => { e.invoice.status_transitions.paid_at += 3600; },
    e => { e.invoice.billing_reason = "subscription_cycle"; }, e => { e.subscription.status = "trialing"; },
    e => { e.invoice.amount_paid--; }, e => { e.invoice.amount_remaining = 1; },
    e => { e.invoice.starting_balance = -100; }, e => { e.invoice.post_payment_credit_notes_amount = 1; },
    e => { e.invoice.total_taxes = null; }, e => { e.invoice.total_taxes[0].amount = -1; },
    e => { e.invoice.total_excluding_tax--; }, e => { e.invoice.currency = "usd"; },
    e => { e.invoice.parent.subscription_details.subscription = "sub_other"; },
    e => { e.session.invoice = "in_other"; }, e => { e.session.customer = "cus_other"; },
    e => { e.price.id = "price_other"; }, e => { e.price.unit_amount = 1; },
    e => { e.subscription.metadata.billingInterval = "month"; }, e => { e.invoice.lines.has_more = true; },
    e => { e.invoice.lines.data[0].quantity = 2; }, e => { e.invoice.lines.data[0].pricing.price_details.price = "price_other"; },
    e => { e.payment.payment.type = "payment_record"; }, e => { e.payment.amount_paid--; },
    e => { e.payment.invoice = "in_other"; }, e => { e.intent.status = "requires_payment_method"; },
    e => { e.intent.amount_received--; }, e => { e.intent.latest_charge = "ch_other"; },
    e => { e.charge.refunded = true; }, e => { e.charge.amount_refunded = 1; },
    e => { e.charge.disputed = true; }, e => { e.charge.paid = false; }, e => { e.charge.captured = false; },
    e => { e.charge.payment_intent = "pi_other"; }, e => { e.charge.customer = "cus_other"; },
    ...["session", "subscription", "invoice", "price", "payment", "intent", "charge"].map(key => (e: any) => { e[key].livemode = false; }),
  ];
  for (const mutate of mutations) { const e = evidence(); mutate(e); assert.equal(receipt(e), null); }
});

test("subscription projection accepts only whitelisted plans and discards arbitrary customer fields", () => {
  const p = receipt(evidence())!;
  assert.deepEqual(googlePurchasePayload({ ...p, email: "private@example.invalid", items: p.items.map(i => ({ ...i, item_name: "Private name" })) }), p);
  for (const override of [{ item_variant: "private@example.invalid" }, { item_id: "sub_private" }, { quantity: 2 }, { price: 1 }]) {
    assert.equal(googlePurchasePayload({ ...p, items: [{ ...p.items[0], ...override }] }), null);
  }
  assert.equal(googlePurchasePayload({ ...p, shipping: 3 }), null);
});

test("subscription receipt rejects Test IDs before any provider call", async () => {
  const stripe = { checkout: { sessions: { retrieve() { throw new Error("Must not call Stripe"); } } } } as unknown as Stripe;
  for (const input of ["cs_test_fixture", "", "private@example.invalid", "cs_live_" + "a".repeat(191)]) {
    assert.equal(await subscriptionPurchaseReceipt(stripe, input), null);
  }
});
