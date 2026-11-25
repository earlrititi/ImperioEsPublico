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
