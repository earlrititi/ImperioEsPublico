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

test("Meta variants keep stable SKUs, a common group and the official product destination", () => {
  const variants = ["S", "M", "L", "XL", "XXL"].map(name => ({
    sku: `IE-CAMISETA-IMPERIAL-${name}`, name, color: "Blanco", available: name !== "XL",
  }));
  const xml = metaCatalogXml({ unitPrice: 2699, reservationMode: false, salesEnabled: true, variants });
  const items = xml.match(/<item>.*?<\/item>/g)!;
  assert.equal(items.length, variants.length);
  for (const [index, variant] of variants.entries()) {
    const item = items[index];
    assert.ok(item.includes(`<g:id>${variant.sku}</g:id>`));
    assert.match(item, /<g:item_group_id>IE-CAMISETA-IMPERIAL<\/g:item_group_id>/);
    assert.match(item, /<g:brand>IMPERIO ESPA\u00d1OL<\/g:brand>/);
    assert.match(item, /<g:google_product_category>Apparel &amp; Accessories &gt; Clothing &gt; Shirts &amp; Tops<\//);
    assert.ok(item.includes(`<g:link>https://imperioes.com/instagram?size=${variant.name}&amp;`));
    assert.match(item, /<g:price>26\.99 EUR<\/g:price>/);
    assert.ok(item.includes(`<g:availability>${variant.available ? "in stock" : "out of stock"}</g:availability>`));
    assert.match(item, /<g:image_link>https:\/\/imperioes\.com\/images\/camiseta-imperio-frontal\.webp<\//);
    assert.match(item, /<g:additional_image_link>https:\/\/imperioes\.com\/images\/camiseta-imperio-atras\.webp<\//);
  }
  assert.doesNotMatch(xml, /<(?:g:)?(?:inventory|available_stock|quantity|email|token)>/);
});

test("Attribution allows campaign labels, never personal or management data", () => {
  const params = campaignParameters("?utm_source=instagram&utm_campaign=non_sufficit_orbis&utm_term=user%40mail.com&token=secret&email=user%40mail.com");
  assert.equal(params.toString(), "utm_source=instagram&utm_campaign=non_sufficit_orbis");
});
