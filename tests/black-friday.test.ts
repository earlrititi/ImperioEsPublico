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
