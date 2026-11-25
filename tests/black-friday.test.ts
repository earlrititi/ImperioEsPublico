import { test } from "node:test";
import assert from "node:assert/strict";
import { blackFridayActive, BLACK_FRIDAY_START, BLACK_FRIDAY_END, BLACK_FRIDAY_PATH } from "../src/config/black-friday";
import { FUNNEL_PAGES } from "../src/lib/funnel";
test("Black Friday window uses mainland Spain time and expires automatically", () => {
  assert.equal(blackFridayActive(BLACK_FRIDAY_START - 1), false);
  assert.equal(blackFridayActive(BLACK_FRIDAY_START), true);
  assert.equal(blackFridayActive(BLACK_FRIDAY_END - 1), true);
  assert.equal(blackFridayActive(BLACK_FRIDAY_END), false);
  assert.equal(new Date(BLACK_FRIDAY_END).toISOString(), "2026-11-30T23:00:00.000Z");
});
test("Campaign landing is included in the consented shirt funnel", () => {
  assert.equal(FUNNEL_PAGES.test(BLACK_FRIDAY_PATH), true);
  assert.equal(FUNNEL_PAGES.test("/tienda/black-friday/private"), false);
});

import { BLACK_FRIDAY_OFFER_START, BLACK_FRIDAY_PRICE_CENTS, BLACK_FRIDAY_PREVIOUS_PRICE_CENTS, blackFridayOfferActive, blackFridayDiscount, blackFridayEligible } from "../src/config/black-friday";
test("Offer has a real start and end and does not alter the base price", () => {
  assert.equal(blackFridayOfferActive(BLACK_FRIDAY_OFFER_START - 1), false);
  assert.equal(blackFridayOfferActive(BLACK_FRIDAY_OFFER_START), true);
  assert.equal(blackFridayOfferActive(BLACK_FRIDAY_END - 1), true);
  assert.equal(blackFridayOfferActive(BLACK_FRIDAY_END), false);
  assert.equal(BLACK_FRIDAY_PREVIOUS_PRICE_CENTS - blackFridayDiscount(1), BLACK_FRIDAY_PRICE_CENTS);
  assert.equal(blackFridayDiscount(3), 1200);
  assert.throws(() => blackFridayDiscount(0));
  assert.throws(() => blackFridayDiscount(1.5));
});
test("Checkout attempt eligibility is server-timed and delivery-aware", () => {
  const during = new Date(BLACK_FRIDAY_OFFER_START).toISOString();
  const before = new Date(BLACK_FRIDAY_OFFER_START - 1).toISOString();
  assert.equal(blackFridayEligible(during, "standard", BLACK_FRIDAY_END), true);
  assert.equal(blackFridayEligible(during, "priority", BLACK_FRIDAY_END), true);
  assert.equal(blackFridayEligible(during, undefined, BLACK_FRIDAY_END), false);
  assert.equal(blackFridayEligible(before, "standard", BLACK_FRIDAY_END), false);
  assert.equal(blackFridayEligible(during, "standard", BLACK_FRIDAY_OFFER_START - 1), false);
  assert.equal(blackFridayEligible("bad", "standard", BLACK_FRIDAY_END), false);
});

import type Stripe from "stripe";
import { blackFridayCoupon } from "../src/lib/black-friday-coupon";
import { ecommercePayload } from "../src/lib/ecommerce";
test("Campaign analytics value reflects the advertised price in the offer window", () => {
  const items = [{ size: "M" as const, quantity: 3 }];
  assert.equal(ecommercePayload("begin_checkout", items, BLACK_FRIDAY_OFFER_START)?.value, 68.97);
  assert.equal(ecommercePayload("begin_checkout", items, BLACK_FRIDAY_END)?.value, 80.97);
});
test("Stripe coupon is product-scoped, exact and reusable, including multiple shirts", async () => {
  const productId = "prod_fixture";
  const id = "imperio_bf2026_3_prod_fixture";
  const coupon = { id, valid: true, livemode: false, duration: "once", amount_off: 1200, currency: "eur", percent_off: null, applies_to: { products: [productId] } };
  let created = 0;
  const fake = { coupons: {
    retrieve: async () => { if (!created) throw { code: "resource_missing" }; return coupon; },
    create: async (params: any, options: any) => { created++; assert.equal(params.amount_off, 1200); assert.equal(params.currency, "eur"); assert.deepEqual(params.applies_to.products, [productId]); assert.equal(options.idempotencyKey, id); return coupon; },
  } } as unknown as Stripe;
  assert.equal(await blackFridayCoupon(fake, productId, 3, false), id);
  assert.equal(await blackFridayCoupon(fake, productId, 3, false), id);
  assert.equal(created, 1);
  await assert.rejects(() => blackFridayCoupon(fake, productId, 3, true), /INVALID_PROMOTION_CONFIGURATION/);
  coupon.amount_off = 1199;
  await assert.rejects(() => blackFridayCoupon(fake, productId, 3, false), /INVALID_PROMOTION_CONFIGURATION/);
});
