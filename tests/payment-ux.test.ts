import assert from "node:assert/strict";
import test from "node:test";
import { h } from "preact";
import render from "preact-render-to-string";
import { readFileSync } from "node:fs";
import ReservationForm from "../src/components/commerce/ReservationForm";
import { AddressFields, emptyAddress } from "../src/components/commerce/shared";
import SubscriptionConfirmation from "../src/components/commerce/SubscriptionConfirmation";
import { SHIRT_PRICE_COPY } from "../src/config/commerce";

test("Shirt contact is collected once and a separate recipient is optional", () => {
  const html = render(h(ReservationForm, { initialCustomer: { name: "Cliente Prueba", email: "fixture@example.invalid" } }));
  assert.equal((html.match(/autocomplete="name"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /autocomplete="shipping name"/);
  assert.match(html, /Enviar a otra persona/);
  assert.match(html, /value="Cliente Prueba"/);
  assert.match(html, /value="fixture@example.invalid"/);
  assert.match(html, /inputmode="numeric"/);
  const recipient = render(h(AddressFields, { value: emptyAddress, onChange: () => {}, includeRecipient: true }));
  assert.match(recipient, /autocomplete="shipping name"/);
});

test("Payment return never claims success before a server-side confirmation", () => {
  const html = render(h(SubscriptionConfirmation, { sessionId: "cs_live_fixture" }));
  assert.match(html, /Estamos comprobando tu acceso/);
  assert.doesNotMatch(html, /Acceso premium activado/);
  const manager = readFileSync(new URL("../src/components/commerce/ReservationManager.tsx", import.meta.url), "utf8");
  assert.match(manager, /paymentReturn && r\.status === "PAYMENT_PENDING"/);
  assert.match(manager, /&& !confirming/);
  assert.match(manager, /\{editing &&/);
  assert.match(manager, /submitting\.current \|\| busy \|\| editing/);
  assert.match(manager, /history\.replaceState\(null, "", window\.location\.pathname\)/);
});

test("Purchase loading never flashes a free reservation or an empty cart", () => {
  const html = render(h(ReservationForm, { initialSales: true, fromCart: true }));
  assert.match(html, /Compra de camiseta/);
  assert.match(html, /Comprobando disponibilidad y precio/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /Pre-reserva gratuita|RESERVAR|0,00|Tu carrito est/);
  assert.match(html, /29,99/);
  assert.match(html, /envío peninsular e IVA incluidos/);
  assert.match(html, /No necesitas crear una cuenta/);
});

test("All purchase entry points disclose the delivered total before customer details", () => {
  assert.match(SHIRT_PRICE_COPY, /^29,99/);
  assert.match(SHIRT_PRICE_COPY, /26,99.*3.*por unidad/);
  for (const file of ["src/pages/reservas/index.astro", "src/pages/tienda/index.astro", "src/pages/instagram.astro", "src/components/TshirtLeadPopup.astro"]) {
    assert.match(readFileSync(file, "utf8"), /SHIRT_(?:PRICE|TOTAL)_COPY/);
  }
  const instagram = readFileSync("src/pages/instagram.astro", "utf8");
  assert.match(instagram, /inventory\.unitPrice \+ inventory\.shippingPerUnit/);
  assert.match(instagram, /data\.unitPrice \+ data\.shippingPerUnit/);
  assert.doesNotMatch(instagram, /<a[^>]*class="ig-cta[^>]*data-community/);
  assert.match(instagram, /<details><summary>Descuentos para suscriptores/);
});

test("Guest shirt checkout is token-authorized and does not require a new user account", () => {
  const checkout = readFileSync("src/pages/api/reservations/[id]/checkout.ts", "utf8");
  assert.match(checkout, /authorizedReservation\(/);
  assert.match(checkout, /customer_creation: "if_required"/);
  assert.doesNotMatch(checkout, /if\s*\(!user\)|auth\.signUp|\/registro|\/login/);
  const page = readFileSync("src/pages/reservas/index.astro", "utf8");
  assert.doesNotMatch(page, /Astro\.redirect|auth\.signUp/);
});

test("offer never interrupts newsletter, subscriptions, store, cart or cookie choices", () => {
  const popup = readFileSync(new URL("../src/components/TshirtLeadPopup.astro", import.meta.url), "utf8");
  assert.match(popup, /\|tienda\(/);
  assert.match(popup, /\|carrito\(/);
  assert.match(popup, /\|suscribirse\(/);
  assert.match(popup, /\|newsletter\(/);
  assert.match(popup, /data-cookie-banner\]:not\(\[hidden\]\)/);
  assert.match(popup, /waitingForCookies/);
});
