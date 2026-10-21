import { test } from "node:test";
import assert from "node:assert/strict";
import { metaCatalogXml } from "../src/lib/meta-catalog";
import { campaignParameters } from "../src/lib/social-attribution";

test("Meta feed uses actual variants, price and stock with preorder availability", () => {
  const xml = metaCatalogXml({ unitPrice: 2699, reservationMode: true, variants: [
    { sku: "IE-S", name: "S", color: "Blanco & negro", available: true },
    { sku: "IE-M", name: "M", color: "Blanco", available: false },
  ] });
  assert.equal((xml.match(/<item>/g) || []).length, 2);
  assert.match(xml, /26.99 EUR/);
  assert.match(xml, /3 EUR por camiseta/);
  assert.match(xml, /<g:availability>preorder/);
  assert.match(xml, /<g:availability>out of stock/);
  assert.match(xml, /Blanco &amp; negro/);
  assert.match(xml, /size=S&amp;utm_source=instagram/);
  assert.doesNotMatch(xml, /<g:size>XL/);
  assert.doesNotMatch(xml, /<g:inventory>/);
});

test("Closed reservation flow never advertises an available purchase", () => {
  const xml = metaCatalogXml({ unitPrice: 2999, reservationMode: false, variants: [
    { sku: "IE-S", name: "S", color: "Blanco", available: true },
  ] });
  assert.match(xml, /<g:availability>out of stock/);
});

test("Live purchases are in stock, not advertised as sold out or free reservations", () => {
  const xml = metaCatalogXml({ unitPrice: 2999, reservationMode: false, salesEnabled: true, variants: [
    { sku: "IE-S", name: "S", color: "Blanco", available: true },
  ] });
  assert.match(xml, /<g:availability>in stock/);
  assert.doesNotMatch(xml, /Reserva gratuita|<g:inventory>/);
});

test("Attribution allows campaign labels, never personal or management data", () => {
  const params = campaignParameters("?utm_source=instagram&utm_campaign=non_sufficit_orbis&utm_term=user%40mail.com&token=secret&email=user%40mail.com");
  assert.equal(params.toString(), "utm_source=instagram&utm_campaign=non_sufficit_orbis");
});
