import test from "node:test";
import assert from "node:assert/strict";
import { confirmedShirtPurchase } from "../src/lib/purchase-analytics";
import { googlePurchasePayload } from "../src/lib/ecommerce";

function paidReservation() {
  const id = "00000000-0000-4000-8000-000000000001";
  const orderId = "00000000-0000-4000-8000-000000000002";
  return { id, order_id: orderId, status: "CONVERTED_TO_ORDER", stripe_checkout_session_id: "cs_live_fixture",
    stripe_payment_intent_id: "pi_fixture", commerce_orders: { id: orderId, reservation_id: id,
      status: "READY_FOR_FULFILLMENT", stripe_checkout_session_id: "cs_live_fixture", stripe_payment_intent_id: "pi_fixture",
      paid_at: new Date().toISOString(), currency: "eur", total_quantity: 2, subtotal: 5998, total: 5998,
      vat_amount: 1040, discount_amount: 0, refunded_amount: 0, customer_email: "private@example.invalid",
      shipping_address: { line1: "Private address" }, commerce_order_items: ["M", "L"].map(size => ({
        sku: `IE-CAMISETA-IMPERIAL-${size}`, size, quantity: 1, unit_price: 2999, line_total: 2999, currency: "eur",
        product_name: "Private custom title", color: "Private value" })) } };
}

test("confirmed shirt purchase reconciles net merchandise, VAT and shipping to the actual charge", () => {
  const r = paidReservation();
  const p = confirmedShirtPurchase(r)!;
  assert.equal(p.value, 44.62); assert.equal(p.tax, 10.40); assert.equal(p.shipping, 4.96);
  assert.equal(Math.round((p.value + p.tax + p.shipping) * 100), r.commerce_orders.total);
  assert.equal(p.items.reduce((sum, i) => sum + i.price * i.quantity, 0), p.value);
  assert.match(p.transaction_id, /^ie_[a-f0-9]{64}$/);
  assert.equal(confirmedShirtPurchase(r)?.transaction_id, p.transaction_id);
  assert.doesNotMatch(JSON.stringify(p), /private|address|email|pi_fixture|cs_live|00000000/i);
  assert.deepEqual(googlePurchasePayload(p), p);
});

test("discounted multi-size purchases allocate actual net revenue without rounding drift", () => {
  const r = paidReservation(), o = r.commerce_orders;
  o.total_quantity = 3; o.subtotal = 8997; o.total = 7378; o.discount_amount = 1619; o.vat_amount = 1280;
  o.commerce_order_items[0].quantity = 2; o.commerce_order_items[0].line_total = 5998;
  const p = confirmedShirtPurchase(r)!;
  assert.ok(p);
  assert.equal(Math.round((p.value + p.tax + p.shipping) * 100), 7378);
  assert.equal(Math.round(p.items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100), Math.round(p.value * 100));
  assert.equal(p.items.find(i => i.item_variant === "M")?.quantity, 2);
});

test("unpaid, forged, historical, refunded, Test or inconsistent orders cannot produce a purchase", () => {
  const mutations = [
    (r: any) => { r.status = "PAYMENT_PENDING"; },
    (r: any) => { r.commerce_orders = null; },
    (r: any) => { r.order_id = "other"; },
    (r: any) => { r.commerce_orders.reservation_id = "other"; },
    (r: any) => { r.commerce_orders.stripe_checkout_session_id = "cs_test_fixture"; r.stripe_checkout_session_id = "cs_test_fixture"; },
    (r: any) => { r.stripe_checkout_session_id = "cs_live_other"; },
    (r: any) => { r.stripe_payment_intent_id = "pi_other"; },
    (r: any) => { r.commerce_orders.refunded_amount = 1; },
    (r: any) => { r.commerce_orders.status = "REFUNDED"; },
    (r: any) => { r.commerce_orders.paid_at = new Date(Date.now() - 25 * 3600000).toISOString(); },
    (r: any) => { r.commerce_orders.paid_at = new Date(Date.now() + 3600000).toISOString(); },
    (r: any) => { r.commerce_orders.total--; },
    (r: any) => { r.commerce_orders.vat_amount = -1; },
    (r: any) => { r.commerce_orders.currency = "usd"; },
    (r: any) => { r.commerce_orders.commerce_order_items[0].size = "3XL"; },
    (r: any) => { r.commerce_orders.commerce_order_items[0].quantity = 0; },
    (r: any) => { r.commerce_orders.commerce_order_items[0].unit_price = 2699; },
    (r: any) => { r.commerce_orders.commerce_order_items.push(r.commerce_orders.commerce_order_items[0]); },
  ];
  for (const mutate of mutations) { const r = paidReservation(); mutate(r); assert.equal(confirmedShirtPurchase(r), null); }
});

test("browser payload projection discards personal data and rejects corrupt amounts/items", () => {
  const p = confirmedShirtPurchase(paidReservation())!;
  assert.deepEqual(googlePurchasePayload({ ...p, email: "private@example.invalid", items: p.items.map(i => ({ ...i, item_name: "Private", address: "Secret" })) }), p);
  for (const input of [null, {}, { ...p, value: NaN }, { ...p, value: 0 }, { ...p, transaction_id: "private@example.invalid" },
    { ...p, items: [] }, { ...p, items: [null] }, { ...p, items: [{ ...p.items[0], price: 123 }] }]) {
    assert.equal(googlePurchasePayload(input), null);
  }
});
