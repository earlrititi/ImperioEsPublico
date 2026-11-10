import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesForTshirtOffer, shirtDiscountPercent, shirtOfferCopy } from "../src/config/tshirt-offer";
import { PLAN_COMPARISON_LABELS, SERVICES_ITEMS } from "../src/config/home";
import { readFileSync } from "node:fs";

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

test("personal discount emails use only the subscriber's tier copy, never the mixed public offer", () => {
  assert.doesNotMatch(shirtOfferCopy("maestre_campo"), /15%/);
  assert.doesNotMatch(shirtOfferCopy("arcabucero"), /20%/);
  const source = readFileSync("src/lib/emails.ts", "utf8");
  assert.doesNotMatch(source, /TSHIRT_OFFER_COPY/);
  assert.match(source, /const offer = shirtOfferCopy\(params\.percent === 20/);
  assert.match(source, /const offer = shirtOfferCopy\(params\.planName === "MAESTRE DE CAMPO"/);
});

test("The subscription comparison aligns current rows and preserves the plan-specific discount", () => {
  for (const service of SERVICES_ITEMS) {
    assert.equal(service.highlights.length, PLAN_COMPARISON_LABELS.length);
    service.highlights.forEach((copy, index) => {
      if (/próximamente/i.test(copy)) assert.equal(PLAN_COMPARISON_LABELS[index], "Foro");
    });
  }
  const discountRow = PLAN_COMPARISON_LABELS.indexOf("Descuento drops");
  assert.notEqual(discountRow, -1);
  assert.match(SERVICES_ITEMS[1].highlights[discountRow] ?? "", /15%/);
  assert.match(SERVICES_ITEMS[2].highlights[discountRow] ?? "", /20%/);
  for (const service of SERVICES_ITEMS.slice(1)) {
    assert.doesNotMatch(service.highlights[discountRow] ?? "", /un solo uso/i);
  }
  assert.match(shirtOfferCopy("arcabucero"), /^15%/);
  assert.match(shirtOfferCopy("maestre_campo"), /^20%/);
});
