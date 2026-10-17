import test from "node:test";
import assert from "node:assert/strict";
import { paidOrderNotification } from "../src/lib/admin-notifications";

const order = { number: "PED-TEST", customer_name: "Cliente sintetico", customer_email: "test@example.invalid", customer_phone: "",
  shipping_address: { name: "Otra destinataria", line1: "Calle Test 1", line2: "Piso 2", postalCode: "28001", city: "Madrid", province: "28" },
  total_quantity: 3, total: 8997, currency: "eur", paid_at: "2026-10-12T10:00:00Z", status: "READY_FOR_FULFILLMENT",
  commerce_order_items: [{ size: "M", quantity: 1, product_name: "Camiseta Imperial" }, { size: "L", quantity: 2, product_name: "Camiseta Imperial" }] };
test("paid order notice uses final address, every size and quantity, amount and actual payment date", () => {
  const notice = paidOrderNotification(order);
  assert.match(notice.subject, /Pedido pagado de camisetas: PED-TEST/);
  for (const text of ["Cliente sintetico", "test@example.invalid", "Otra destinataria", "Calle Test 1", "Piso 2", "28001", "Madrid",
    "Cantidad total de camisetas: 3", "Talla M: 1", "Talla L: 2", "89,97", "12/10/2026", "No es una reserva ni un nuevo cobro"]) assert.ok(notice.text.includes(text), text);
  assert.doesNotMatch(notice.text, /token|https?:|No se ha realizado ningun cobro/);
});
test("incomplete paid-order data is retained for review instead of sending a false complete notice", () => {
  for (const change of [{ shipping_address: { ...order.shipping_address, line1: "" } }, { customer_name: "" }, { currency: "usd" },
    { paid_at: "bad" }, { total_quantity: 4 }, { commerce_order_items: [] }, { commerce_order_items: [{ size: "M", quantity: -1, product_name: "Test" }] }]) {
    assert.throws(() => paidOrderNotification({ ...order, ...change }), /ORDER_NOTICE_DATA_INCOMPLETE/);
  }
});
test("a refund is disclosed separately from the original payment", () => {
  assert.match(paidOrderNotification({ ...order, status: "REFUNDED", refunded_amount: 8997 }).text, /Importe reembolsado: 89,97/);
});
