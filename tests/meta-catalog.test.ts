import { test } from "node:test";
import assert from "node:assert/strict";
import { metaCatalogXml } from "../src/lib/meta-catalog";
import { campaignParameters } from "../src/lib/social-attribution";

test("Meta feed uses actual variants, price and stock with preorder availability", () => {
  const xml = metaCatalogXml({ unitPrice: 2999, reservationMode: true, variants: [
    { sku: "IE-S", name: "S", color: "Blanco & negro", available_stock: 2 },
    { sku: "IE-M", name: "M", color: "Blanco", available_stock: 0 },
  ] });
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.match(xml, /29.99 EUR/);
  assert.match(xml, /<g:availability>preorder/);
  assert.match(xml, /<g:availability>out of stock/);
  assert.match(xml, /Blanco &amp; negro/);
  assert.match(xml, /size=S&amp;utm_source=instagram/);
  assert.doesNotMatch(xml, /<g:size>XL/);
});

test("Closed reservation flow never advertises an available purchase", () => {
  const xml = metaCatalogXml({ unitPrice: 2999, reservationMode: false, variants: [
    { sku: "IE-S", name: "S", color: "Blanco", available_stock: 2 },
  ] });
  assert.match(xml, /<g:availability>out of stock/);
});

test("Attribution allows campaign labels, never personal or management data", () => {
  const params = campaignParameters("?utm_source=instagram&utm_campaign=non_sufficit_orbis&utm_term=user%40mail.com&token=secret&email=user%40mail.com");
  assert.equal(params.toString(), "utm_source=instagram&utm_campaign=non_sufficit_orbis");
});
