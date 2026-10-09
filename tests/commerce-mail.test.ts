import assert from "node:assert/strict";
import test from "node:test";
import { reservationMailText } from "../src/lib/commerce-mail";

const reservation = {
  number: "RES-TEST", status: "RESERVED", total_price_snapshot: 2999,
  reservation_items: [{ product_name: "Camiseta Imperial", sku: "TEST-M",
    size: "M", color: "Blanco", quantity: 1, unit_price_snapshot: 2999,
    line_total_snapshot: 2999 }],
};

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
