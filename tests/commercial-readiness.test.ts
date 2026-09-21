import assert from "node:assert/strict";
import test from "node:test";
import { isCheckoutModeEnabled } from "../src/lib/commercial-readiness";

test("Live checkout requires explicit launch confirmation", () => {
  for (const setting of [undefined, "", "false", "TRUE", "1"]) {
    assert.equal(isCheckoutModeEnabled(true, setting), false);
  }
  assert.equal(isCheckoutModeEnabled(true, "true"), true);
});

test("Test prices stay usable without opening Live sales", () => {
  for (const setting of [undefined, "false", "true"]) {
    assert.equal(isCheckoutModeEnabled(false, setting), true);
  }
});

test("Unknown price mode fails closed even with launch confirmation", () => {
  assert.equal(isCheckoutModeEnabled(undefined, undefined), false);
  assert.equal(isCheckoutModeEnabled(undefined, "true"), false);
});
