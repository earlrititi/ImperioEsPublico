import assert from "node:assert/strict";
import test from "node:test";
import { h } from "preact";
import render from "preact-render-to-string";
import AdminOrderPricing, { AdminSaleUnitPrices } from "../src/components/commerce/AdminOrderPricing";

// Financial shape reconciled against the 27/11 Black Friday charge, with no customer data.
const paid = {
  status: "READY_FOR_FULFILLMENT", currency: "eur", total_quantity: 1, subtotal: 2699,
  product_subtotal: 2699, shipping_amount: 0, shipping_method: "standard",
  discount_amount: 400, total: 2299, refunded_amount: 0,
  commerce_order_items: [{ id: "shirt", sku: "IE-CAMISETA-IMPERIAL-XXL", currency: "eur", quantity: 1, unit_price: 2699, line_total: 2699 }],
};
const text = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");

test("paid Black Friday shirt displays the charged unit price and an explicit original price", () => {
  const before = JSON.stringify(paid);
  const detail = text(render(h(AdminOrderPricing, { order: paid })));
  assert.match(detail, /Precio de venta: 22,99 € por camiseta/);
  assert.match(detail, /Antes del descuento: 26,99 € por camiseta/);
  assert.match(detail, /Camisetas después de descuentos: 22,99 €/);
  assert.match(detail, /Descuento: 4,00 €/);
  assert.match(detail, /Total cobrado: 22,99 €/);
  const summary = text(render(h(AdminSaleUnitPrices, { order: paid })));
  assert.match(summary, /22,99 € por camiseta/);
  assert.doesNotMatch(summary, /26,99|29,99/);
  assert.equal(JSON.stringify(paid), before);
});

test("priority shipping and refunds do not become part of the original shirt sale price", () => {
  const detail = text(render(h(AdminOrderPricing, { order: {
    ...paid, subtotal: 3398, shipping_method: "priority", shipping_amount: 699,
    total: 2998, refunded_amount: 1000,
  } })));
  assert.match(detail, /Precio de venta: 22,99 € por camiseta/);
  assert.match(detail, /Envío: 6,99 €.*Envío prioritario/);
  assert.match(detail, /Total cobrado: 29,98 €/);
  assert.match(detail, /Reembolsado: 10,00 €/);
});

test("unpaid or inconsistent amounts never present a confirmed sale price", () => {
  for (const order of [{ ...paid, status: "PAYMENT_PENDING" }, { ...paid, total: 2298 }]) {
    assert.equal(render(h(AdminSaleUnitPrices, { order })), "");
    const detail = text(render(h(AdminOrderPricing, { order })));
    assert.equal(detail, "Desglose del precio de venta sin verificar.");
  }
});
