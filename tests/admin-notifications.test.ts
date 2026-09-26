import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_NOTIFICATION_EMAIL, reservationNotification, subscriptionNotification } from "../src/lib/admin-notifications";

test("Reservation notice includes address, sizes and total quantity without private links", () => {
  const notice = reservationNotification({
    number: "RES-TEST", status: "RESERVED", customer_name: "Cliente Prueba",
    customer_email: "cliente@example.invalid",
    shipping_address: { name: "Cliente Prueba", line1: "Calle Prueba 12", postalCode: "28001", city: "Madrid", province: "28" },
    reservation_items: [{ size: "M", quantity: 2 }, { size: "L", quantity: 1 }],
    total_price_snapshot: 8997,
  });
  assert.equal(ADMIN_NOTIFICATION_EMAIL, "earlrititi@gmail.com");
  assert.match(notice.text, /Cantidad de camisetas: 3/);
  assert.match(notice.text, /Calle Prueba 12, 28001, Madrid, Madrid, Espana/);
  assert.match(notice.text, /Talla M: 2/);
  assert.match(notice.text, /No se ha realizado ningun cobro/);
  assert.doesNotMatch(notice.text, /https?:|token/);
});

test("Subscription notices distinguish annual and monthly with optional legacy address", () => {
  const invoice = { id: "in_test", customer_name: "Prueba", customer_email: "cliente@example.invalid" };
  assert.match(subscriptionNotification(invoice, "ARCABUCERO", "month").text, /Periodicidad: Mensual/);
  const annual = subscriptionNotification(invoice, "MAESTRE DE CAMPO", "year");
  assert.match(annual.subject, /MAESTRE DE CAMPO \(anual\)/);
  assert.match(annual.text, /Direccion de facturacion: No facilitada/);
  assert.match(subscriptionNotification({ ...invoice, customer_address: { line1: "Calle 12", city: "Madrid", country: "ES" } }, "ARCABUCERO", "year").text, /Calle 12, Madrid, ES/);
});
