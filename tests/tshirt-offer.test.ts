import assert from "node:assert/strict";
import test from "node:test";
import { qualifiesForTshirtOffer, shirtDiscountPercent, shirtOfferCopy } from "../src/config/tshirt-offer";
import { PLAN_COMPARISON_LABELS, SERVICES_ITEMS } from "../src/config/home";
import { renderCustomerMail } from "../src/lib/customer-mail-catalog";

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
  for (const [percent, planName, excluded] of [[15, "ARCABUCERO", /20%/], [20, "MAESTRE DE CAMPO", /15%/]] as const) {
    const discount = renderCustomerMail("tshirt_discount", {
      to: "fixture@example.test", name: "Lector", code: "FIXTURE", percent, reference: "fixture",
    }, "https://imperioes.com");
    const welcome = renderCustomerMail("paid_welcome", {
      to: "fixture@example.test", planName, priceSummary: "Cuota de prueba", termsVersion: "fixture",
    }, "https://imperioes.com");
    for (const message of [discount, welcome]) {
      assert.doesNotMatch(message.text, excluded);
      assert.match(message.text, new RegExp(`${percent}%`));
    }
  }
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
