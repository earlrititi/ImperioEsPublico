import assert from "node:assert/strict";
import test from "node:test";
import { adminShirtPricing, type AdminShirtOrder } from "../src/lib/admin-shirt-pricing";

function order() {
  return {
    status: "READY_FOR_FULFILLMENT", currency: "eur", total_quantity: 1,
    subtotal: 2699, total: 2299, discount_amount: 400, refunded_amount: 0,
    product_subtotal: 2699, shipping_amount: 0, shipping_method: "standard",
    commerce_order_items: [{ id: "item-XXL", sku: "IE-CAMISETA-IMPERIAL-XXL", quantity: 1,
      unit_price: 2699, line_total: 2699, currency: "eur" }],
  };
}

test("Black Friday admin sale price is the 22.99 actually charged; source snapshots remain unchanged", () => {
  const input = order(), before = structuredClone(input);
  assert.deepEqual(adminShirtPricing(input), {
    productSubtotal: 2699, shippingAmount: 0, productTotal: 2299,
    items: [{ id: "item-XXL", sku: "IE-CAMISETA-IMPERIAL-XXL", quantity: 1,
      originalUnitPrice: 2699, originalTotal: 2699, total: 2299, unitPrice: 2299 }],
  });
  assert.deepEqual(input, before);
});

test("multiple Black Friday sizes and quantities reconcile to 22.99 per shirt", () => {
  const input = order();
  Object.assign(input, { total_quantity: 3, subtotal: 8097, product_subtotal: 8097, total: 6897, discount_amount: 1200 });
  input.commerce_order_items = [
    { ...input.commerce_order_items[0], quantity: 2, line_total: 5398 },
    { ...input.commerce_order_items[0], id: "item-M", sku: "IE-CAMISETA-IMPERIAL-M" },
  ];
  const result = adminShirtPricing(input)!;
  assert.equal(result.productTotal, 6897);
  assert.deepEqual(result.items.map(item => item.unitPrice), [2299, 2299]);
  assert.deepEqual(result.items.map(item => item.total), [4598, 2299]);
});

test("priority postage is excluded from the discounted shirt price", () => {
  const input = order();
  Object.assign(input, { subtotal: 3398, total: 2998, shipping_method: "priority", shipping_amount: 699 });
  const result = adminShirtPricing(input)!;
  assert.equal(result.shippingAmount, 699);
  assert.equal(result.items[0].unitPrice, 2299);
  assert.equal(result.productTotal + result.shippingAmount, input.total);
});

test("legacy postage remains separate with and without stored breakdown columns", () => {
  for (const explicit of [false, true]) {
    const input: AdminShirtOrder = { ...order(), subtotal: 2999, total: 2999, discount_amount: 0,
      product_subtotal: explicit ? 2699 : null, shipping_amount: explicit ? 300 : null, shipping_method: null,
      commerce_order_items: [{ quantity: 1, unit_price: 2999, line_total: 2999, currency: "eur" }] };
    const result = adminShirtPricing(input)!;
    assert.equal(result.productSubtotal, 2699);
    assert.equal(result.shippingAmount, 300);
    assert.equal(result.items[0].unitPrice, 2699);
    assert.equal(result.productTotal + result.shippingAmount, input.total);
  }
});

test("historical discounts and original sale prices do not depend on dates or later refunds", () => {
  for (const created_at of ["2026-10-01T00:00:00Z", "2026-11-27T00:00:00Z", "2027-04-01T00:00:00Z"]) {
    const input = { ...order(), created_at, total: 2159, discount_amount: 540, refunded_amount: 1000 };
    assert.equal(adminShirtPricing(input)?.items[0].unitPrice, 2159);
    input.status = "REFUNDED"; input.refunded_amount = input.total;
    assert.equal(adminShirtPricing(input)?.items[0].unitPrice, 2159);
  }
});

test("uneven discounts preserve cents and suppress a misleading rounded unit price", () => {
  const input = order();
  Object.assign(input, { total_quantity: 3, subtotal: 8097, product_subtotal: 8097, total: 7000, discount_amount: 1097 });
  input.commerce_order_items = [
    { ...input.commerce_order_items[0], quantity: 2, line_total: 5398 },
    { ...input.commerce_order_items[0], id: "item-M", sku: "IE-CAMISETA-IMPERIAL-M" },
  ];
  const result = adminShirtPricing(input)!;
  assert.equal(result.items.reduce((sum, item) => sum + item.total, 0), 7000);
  assert.deepEqual(result.items.map(item => item.total), [4667, 2333]);
  assert.equal(result.items[0].unitPrice, null);
  assert.equal(result.items[1].unitPrice, 2333);
  input.commerce_order_items.reverse();
  assert.deepEqual(adminShirtPricing(input)?.items.map(item => item.total), [2333, 4667]);
});

test("allocation follows historical line values, retaining a discounted total across mixed prices", () => {
  const input = order();
  Object.assign(input, { total_quantity: 2, subtotal: 6000, product_subtotal: 6000, total: 5000, discount_amount: 1000 });
  input.commerce_order_items = [
    { ...input.commerce_order_items[0], unit_price: 2000, line_total: 2000 },
    { ...input.commerce_order_items[0], id: "item-M", sku: "IE-CAMISETA-IMPERIAL-M", unit_price: 4000, line_total: 4000 },
  ];
  assert.deepEqual(adminShirtPricing(input)?.items.map(item => item.total), [1667, 3333]);
});

test("pending, missing or inconsistent records have no fabricated sale price", () => {
  assert.equal(adminShirtPricing(null), null);
  for (const patch of [
    { status: "PAYMENT_PENDING" }, { status: "CANCELLED" }, { status: "CONVERTED_TO_ORDER" },
    { currency: "usd" }, { total_quantity: 2 }, { total: 2298 }, { total: -1 },
    { discount_amount: 400.5 }, { product_subtotal: 2700 }, { shipping_amount: 1 },
    { shipping_method: "unknown" }, { shipping_method: ["standard"] }, { shipping_amount: null }, { commerce_order_items: [] },
    { commerce_order_items: [{ quantity: 1, unit_price: 2699, line_total: 2698, currency: "eur" }] },
    { commerce_order_items: [{ quantity: 0, unit_price: 2699, line_total: 0, currency: "eur" }] },
    { commerce_order_items: [{ quantity: 1, unit_price: 2699, line_total: 2699, currency: "usd" }] },
    { subtotal: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.equal(adminShirtPricing({ ...order(), ...patch }), null, JSON.stringify(patch));
});
