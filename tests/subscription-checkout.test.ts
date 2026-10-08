import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { blocksNewSubscription, findBillingCustomer } from "../src/lib/subscription-checkout";

test("all payable and recoverable subscription states block a second subscription", () => {
  for (const status of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]) assert.equal(blocksNewSubscription(status), true);
  for (const status of ["canceled", "incomplete_expired"]) assert.equal(blocksNewSubscription(status), false);
});

function client(customers: { id: string; livemode: boolean }[], statuses: Record<string, string[]>) {
  return { customers: { async *list() { yield* customers; } }, subscriptions: {
    async *list({ customer }: { customer: string }) { for (const status of statuses[customer] ?? []) yield { status }; },
  } } as unknown as Stripe;
}
test("checks every matching Stripe customer, including an active subscription on the second", async () => {
  await assert.rejects(findBillingCustomer(client([{ id: "old", livemode: true }, { id: "new", livemode: true }], { old: ["canceled"], new: ["active"] }), "test@example.com", true), /SUBSCRIPTION_ALREADY_EXISTS/);
});
test("never mixes live and test customers", async () => {
  await assert.rejects(findBillingCustomer(client([{ id: "test", livemode: false }], {}), "test@example.com", true), /BILLING_MODE_MISMATCH/);
});
test("allows a first purchase and reuses an inactive existing customer", async () => {
  assert.equal(await findBillingCustomer(client([], {}), "test@example.com", true), undefined);
  assert.equal(await findBillingCustomer(client([{ id: "old", livemode: true }], { old: ["canceled"] }), "test@example.com", true), "old");
});
