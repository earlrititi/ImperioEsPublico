import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, getProduct } from "../src/config/products";
import { hasPublishedPaidContent } from "../src/lib/commercial-readiness";
import { checkoutPlans } from "../src/lib/stripe-prices";

test("all subscription checkout keys use unique Stripe environment variables", () => {
  const envNames = Object.values(checkoutPlans).map((plan) => plan.priceEnvName);
  assert.equal(new Set(envNames).size, envNames.length);
  assert.ok(Object.values(checkoutPlans).every((plan) => ["month", "year"].includes(plan.billingInterval)));
});

test("paid checkout remains blocked without eligible published content", () => {
  assert.equal(hasPublishedPaidContent(["piquero"], "arcabucero"), false);
  assert.equal(hasPublishedPaidContent(["piquero"], "maestre_campo"), false);
  assert.equal(hasPublishedPaidContent(["arcabucero"], "arcabucero"), true);
  assert.equal(hasPublishedPaidContent(["maestre-de-campo"], "arcabucero"), false);
  assert.equal(hasPublishedPaidContent(["maestre-de-campo"], "maestre_campo"), true);
});

test("carrier-provided packaging is confirmed while physical checkout remains gated", () => {
  const shirt = PRODUCTS["camiseta-imperial"];
  assert.equal(shirt.legalStatus, "LEGAL_PRODUCT_DATA_INCOMPLETE");
  assert.equal(shirt.packagingProvider, "Correos");
  assert.equal(shirt.packagingCompliance, "CARRIER_PROVIDED_ARTICLE_17_5_CONFIRMED");
});

test("shirt inventory matches the owner's remaining stock, including XXL", () => {
  const shirt = PRODUCTS["camiseta-imperial"];
  assert.deepEqual(shirt.variants, ["S", "M", "L", "XL", "XXL"]);
  assert.deepEqual(shirt.variantDetails.map(({ stock }) => stock), [3, 15, 16, 8, 3]);
  assert.equal(shirt.stock, 45);
  assert.equal(shirt.variantDetails.reduce((total, { stock }) => total + stock, 0), shirt.stock);
});

test("shirt uses the owner-confirmed VAT-inclusive amount and mainland shipping", () => {
  const shirt = PRODUCTS["camiseta-imperial"];
  assert.equal(shirt.expectedUnitAmount, 2999);
  assert.deepEqual(shirt.tax, { percentage: 21, behavior: "inclusive", confirmedByOwner: true });
  assert.equal(shirt.shipping.amount, 0);
  assert.equal(shirt.expectedUnitAmount + shirt.shipping.amount, 2999);
  assert.equal(shirt.shipping.country, "ES");
  assert.equal(shirt.shipping.region, "ES_MAINLAND");
  assert.equal(shirt.shipping.carrier, "Correos");
  assert.equal(shirt.shipping.preparationMaxHours, 48);
  assert.equal(shirt.shipping.deliveryMaxBusinessDays, 7);
});

test("shirt material, care and measurements match the Valento BRICKPLUS sheet", () => {
  const shirt = PRODUCTS["camiseta-imperial"];
  assert.equal(shirt.baseGarmentModel, "Valento BRICKPLUS");
  assert.deepEqual(shirt.composition, [{ fibre: "poliester", percentage: 100 }]);
  assert.equal(shirt.fabricWeightGsm, 145);
  assert.deepEqual(shirt.variantDetails.map(({ lengthCm, widthCm }) => [lengthCm, widthCm]),
    [[66, 50], [69, 53], [72, 56], [75, 59], [78, 62]]);
  assert.match(shirt.careInstructions, /30 grados/);
  assert.match(shirt.careInstructions, /No planchar/);
  assert.equal(shirt.manufacturer, "Valento Textile S.L.");
  assert.equal(shirt.euResponsiblePerson, "Valento Textile S.L.");
  assert.equal(shirt.safetyInformation, null);
  assert.equal(shirt.packagingType, "Sobre de envio");
  assert.equal(shirt.packagingProvider, "Correos");
});

test("unknown products and inherited object keys cannot resolve to products", () => {
  for (const input of [undefined, null, "unknown", "__proto__", "constructor", "toString"]) {
    assert.equal(getProduct(input), null);
  }
});
