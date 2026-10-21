import assert from "node:assert/strict";
import test from "node:test";
import { reservationMailText } from "../src/lib/commerce-mail";

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
  assert.match(text, /44067163Z/);
  assert.match(text, /11160 Barbate/);
  assert.doesNotMatch(text, /Total pagado: 29,99/);
});
