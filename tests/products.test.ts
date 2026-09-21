import assert from "node:assert/strict";
import test from "node:test";
import { getProduct } from "../src/config/products";

test("Shirt preserves owner-confirmed manufacturer details and own stock", () => {
  const product = getProduct("camiseta-imperial");
  assert.ok(product);
  assert.equal(product.baseGarmentBrand, "VALENTO");
  assert.equal(product.manufacturerReference, "CAVABRI");
  assert.notEqual(product.sku, product.manufacturerReference);
  assert.equal(product.manufacturerPhone, "+34 976 595 758");
  assert.equal(product.manufacturerEmail, "info@valento.eu");
  assert.equal(product.euResponsiblePerson, "Valento Textile S.L.");
  assert.equal(product.safetyInformation, null);
  assert.deepEqual(product.composition, [{ fibre: "poliester", percentage: 100 }]);
  assert.equal(product.fabricWeightGsm, 145);
  assert.deepEqual(product.variantDetails, [
    { size: "S", stock: 3, lengthCm: 66, widthCm: 50 },
    { size: "M", stock: 15, lengthCm: 69, widthCm: 53 },
    { size: "L", stock: 16, lengthCm: 72, widthCm: 56 },
    { size: "XL", stock: 8, lengthCm: 75, widthCm: 59 },
    { size: "XXL", stock: 3, lengthCm: 78, widthCm: 62 },
  ]);
  assert.equal(product.stock, 45);
  assert.equal(product.expectedUnitAmount + product.shipping.amount, 2999);
  assert.equal(product.packagingType, "Sobre de envio");
  assert.equal(product.packagingProvider, "Correos");
  assert.equal(product.packagingCompliance, "CARRIER_PROVIDED_ARTICLE_17_5_CONFIRMED");
  assert.equal(product.legalStatus, "LEGAL_PRODUCT_DATA_INCOMPLETE");
});
