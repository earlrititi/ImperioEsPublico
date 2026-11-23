import test from "node:test";
import assert from "node:assert/strict";
import { crmAlerts, validateCommercialPause, CRM_EXPERIMENTS } from "../src/lib/crm-performance";
test("commercial pause requires explicit valid values and an optimistic previous state", () => {
  const expected = { paused: false, kinds: [] };
  assert.deepEqual(validateCommercialPause({ expected, paused: true, kinds: ["welcome", "cart"] }), { expected, paused: true, kinds: ["cart", "welcome"] });
  for (const body of [{ paused: true, kinds: [] }, { expected, paused: "false", kinds: [] }, { expected, paused: false, kinds: ["security"] }, { expected, paused: false, kinds: ["cart", "cart"] }])
    assert.throws(() => validateCommercialPause(body), /INVALID_INPUT/);
});
test("delivery warnings use confirmed delivery and sample floor, not opens", () => {
  assert.deepEqual(crmAlerts({ accepted: 3, delivered: 0, bounced: 0, complained: 0, failed: 0 }), []);
  assert.equal(crmAlerts({ accepted: 30, delivered: 2, bounced: 1, complained: 1, failed: 1 }).length, 4);
  assert.deepEqual(crmAlerts({ accepted: 30, delivered: 30, bounced: 0, complained: 0, failed: 0 }), []);
  assert.ok(CRM_EXPERIMENTS.every(item => item.status.startsWith("Propuesto") && item.minimumPerArm === 4000));
});
