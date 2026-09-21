import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessArcabucero,
  canAccessContentTier,
  canAccessMaestreCampo,
  isActivePaidSubscription,
} from "../src/lib/subscriptions";

test("paid access requires an active or trialing subscription", () => {
  assert.equal(isActivePaidSubscription({ plan: "arcabucero", status: "active" }), true);
  assert.equal(isActivePaidSubscription({ plan: "arcabucero", status: "trialing" }), true);
  assert.equal(isActivePaidSubscription({ plan: "arcabucero", status: "past_due" }), false);
  assert.equal(isActivePaidSubscription({ plan: "maestre_campo", status: "canceled" }), false);
});

test("tier hierarchy grants only the intended content", () => {
  const arcabucero = { plan: "arcabucero", status: "active" };
  const maestre = { plan: "maestre_campo", status: "active" };

  assert.equal(canAccessArcabucero(arcabucero), true);
  assert.equal(canAccessMaestreCampo(arcabucero), false);
  assert.equal(canAccessArcabucero(maestre), true);
  assert.equal(canAccessMaestreCampo(maestre), true);
  assert.equal(canAccessContentTier("piquero", { plan: null, status: null }), true);
  assert.equal(canAccessContentTier("maestre-de-campo", maestre), true);
});
