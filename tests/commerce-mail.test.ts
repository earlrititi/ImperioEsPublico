import assert from "node:assert/strict";
import test from "node:test";
import { reservationMailText, reservationMailEventEligible } from "../src/lib/commerce-mail";

const reservation = {
  number: "RES-TEST", status: "RESERVED", total_price_snapshot: 2999,
  reservation_items: [{ product_name: "Camiseta Imperial", sku: "TEST-M",
    size: "M", color: "Blanco", quantity: 1, unit_price_snapshot: 2999,
    line_total_snapshot: 2999 }],
};

test("Paid orders confirm payment and actual fulfilment windows without outdated launch dates", () => {
  const text = reservationMailText({ ...reservation, status: "CONVERTED_TO_ORDER",
    expires_at: "2026-10-11T00:00:00Z", commerce_orders: { shipping_address: null },
  }, "ORDER_PAID", "https://example.invalid/manage");
  assert.match(text, /Tu compra se ha realizado correctamente/);
  assert.match(text, /maximo de 48 horas/);
  assert.match(text, /maximo de 7 dias laborables/);
  assert.doesNotMatch(text, /13 de octubre de 2026/);
  assert.doesNotMatch(text, /Reserva valida hasta|No tienes obligacion|La reserva no autoriza|NO SE HA REALIZADO/);
});

test("stale reservation events never become new purchase confirmations", () => {
  const now = Date.parse("2026-11-23T12:00:00Z"), future = new Date(now + 3600000).toISOString();
  const invitation = { ...reservation, status: "PURCHASE_AVAILABLE", expires_at: future };
  assert.equal(reservationMailEventEligible(invitation, "PURCHASE_AVAILABLE", now), true);
  for (const state of ["CANCELLED", "EXPIRED", "PAYMENT_PENDING", "PAYMENT_FAILED", "CONVERTED_TO_ORDER"])
    assert.equal(reservationMailEventEligible({ ...invitation, status: state }, "PURCHASE_AVAILABLE", now), false);
  assert.equal(reservationMailEventEligible({ ...invitation, expires_at: "bad" }, "PURCHASE_AVAILABLE", now), false);
  assert.equal(reservationMailEventEligible({ ...invitation, expires_at: new Date(now - 1).toISOString() }, "PURCHASE_AVAILABLE", now), false);
  assert.equal(reservationMailEventEligible({ ...invitation, reservation_payment_attempts: [{ status: "OPEN" }] }, "PURCHASE_AVAILABLE", now), false);
  const paid = { ...invitation, commerce_orders: { paid_at: new Date(now - 1).toISOString(), status: "READY_FOR_FULFILLMENT" } };
  assert.equal(reservationMailEventEligible(paid, "PURCHASE_AVAILABLE", now), false);
  assert.equal(reservationMailEventEligible(paid, "RESERVED", now), false);
  assert.equal(reservationMailEventEligible(paid, "ORDER_PAID", now), true);
  assert.equal(reservationMailEventEligible({ ...paid, commerce_orders: { ...paid.commerce_orders, status: "REFUNDED" } }, "ORDER_PAID", now), false);
  assert.equal(reservationMailEventEligible(reservation, "ORDER_PAID", now), false);
  assert.equal(reservationMailEventEligible(reservation, "RESHIP_EMAIL", now), true);
});

test("Reservation mail distinguishes management link from a later purchase invitation", () => {
  const text = reservationMailText(reservation, "RESERVED", "https://example.invalid/manage");
  assert.match(text, /^¡Gracias por reservar tu pedacito de historia!/);
  assert.match(text, /Empieza a formar parte de nuestra comunidad hasta entonces:\nhttps:\/\/imperioes\.com\/suscribirse/);
  assert.match(text, /por correo el enlace privado/);
  assert.match(text, /invitacion de compra/);
  assert.match(text, /este no es el enlace de compra/);
});

test("Other mail states do not promise a future purchase invitation", () => {
  for (const status of ["WAITLIST", "CANCELLED", "EXPIRED", "PURCHASE_AVAILABLE", "CONVERTED_TO_ORDER"]) {
    const text = reservationMailText({ ...reservation, status }, status, "https://example.invalid/manage");
    assert.doesNotMatch(text, /pedacito de historia|imperioes\.com\/suscribirse/);
    assert.doesNotMatch(text, /12 de octubre|este no es el enlace de compra/);
  }
});

test("Paid mail uses the actual discounted charge and separates postage", () => {
  const text = reservationMailText({ ...reservation, status: "CONVERTED_TO_ORDER",
    commerce_orders: { total: 2459, discount_amount: 540, vat_amount: 427,
      product_subtotal: 2699, shipping_amount: 300, shipping_address: null },
  }, "ORDER_PAID", "https://example.invalid/manage");
  assert.match(text, /Camisetas \(IVA incluido\): 26,99/);
  assert.match(text, /Envio: 3,00/);
  assert.match(text, /Descuento en camisetas: -5,40/);
  assert.match(text, /Total pagado: 24,59/);
  assert.match(text, /Vendedor: Imperio Español/);
  assert.doesNotMatch(text, /Adrian Lopez Oliva|44067163Z|11160 Barbate|Sobre los/);
  assert.doesNotMatch(text, /Total pagado: 29,99/);
});
