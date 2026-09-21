import assert from "node:assert/strict";
import test from "node:test";
import { isValidEsVatRate } from "../src/lib/stripe-tax";
import { checkoutPlans, getCheckoutPlan, isCheckoutPriceValid } from "../src/lib/stripe-prices";

test("manual VAT is active, inclusive, 21 percent and isolated by Stripe mode", () => {
  const rate = { active: true, inclusive: true, percentage: 21, country: "ES", livemode: false };
  assert.equal(isValidEsVatRate(rate, false), true);
  for (const change of [{ active: false }, { inclusive: false }, { percentage: 20 }, { country: "FR" }, { livemode: true }]) {
    assert.equal(isValidEsVatRate({ ...rate, ...change }, false), false);
  }
});

test("the four server-selected subscription prices preserve their final amounts", () => {
  for (const plan of Object.values(checkoutPlans)) {
    const price = { active: true, currency: "eur", unit_amount: plan.expectedUnitAmount, type: "recurring",
      recurring: { interval: plan.billingInterval, interval_count: 1 } };
    assert.equal(isCheckoutPriceValid(price, plan), true);
    assert.equal(isCheckoutPriceValid({ ...price, unit_amount: price.unit_amount + 1 }, plan), false);
    assert.equal(isCheckoutPriceValid({ ...price, currency: "usd" }, plan), false);
    assert.equal(isCheckoutPriceValid({ ...price, recurring: { ...price.recurring, interval_count: 2 } }, plan), false);
  }
  for (const input of ["__proto__", "constructor", "toString"]) assert.equal(getCheckoutPlan(input), null);
});
