import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesForTshirtOffer, shirtDiscountPercent } from "../src/config/tshirt-offer";
import { PLAN_COMPARISON_LABELS, SERVICES_ITEMS } from "../src/config/home";

test("Active paid plans grant their non-stacking shirt benefit", () => {
  assert.equal(qualifiesForTshirtOffer({ plan: "arcabucero", status: "active" }), true);
  for (const status of ["trialing", "past_due", "unpaid", "incomplete", "canceled"])
    assert.equal(qualifiesForTshirtOffer({ plan: "arcabucero", status }), false);
  assert.equal(qualifiesForTshirtOffer({ plan: "maestre_campo", status: "active" }), true);
  assert.equal(shirtDiscountPercent({ plan: "arcabucero", status: "active" }), 15);
  assert.equal(shirtDiscountPercent({ plan: "maestre_campo", status: "active" }), 20);
  assert.equal(shirtDiscountPercent({ plan: "maestre_campo", status: "canceled" }), 0);
  assert.equal(qualifiesForTshirtOffer(null), false);
});

test("The subscription comparison has matching rows and only the forum is forthcoming", () => {
  for (const service of SERVICES_ITEMS) {
    assert.equal(service.highlights.length, PLAN_COMPARISON_LABELS.length);
    service.highlights.forEach((copy, index) => {
      if (/próximamente/i.test(copy)) assert.equal(PLAN_COMPARISON_LABELS[index], "Foro");
    });
  }
  assert.match(SERVICES_ITEMS[1].highlights.at(-1) ?? "", /15%/);
});
