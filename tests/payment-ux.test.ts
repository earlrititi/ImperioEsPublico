import assert from "node:assert/strict";
import test from "node:test";
import { h } from "preact";
import render from "preact-render-to-string";
import { readFileSync } from "node:fs";
import ReservationForm from "../src/components/commerce/ReservationForm";
import { AddressFields, emptyAddress } from "../src/components/commerce/shared";
import SubscriptionConfirmation from "../src/components/commerce/SubscriptionConfirmation";

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
  const html = render(h(SubscriptionConfirmation, {}));
  assert.match(html, /Estamos comprobando tu acceso/);
  assert.doesNotMatch(html, /Acceso premium activado/);
  const manager = readFileSync(new URL("../src/components/commerce/ReservationManager.tsx", import.meta.url), "utf8");
  assert.match(manager, /paymentReturn && r\.status === "PAYMENT_PENDING"/);
  assert.match(manager, /&& !confirming/);
  assert.match(manager, /\{editing &&/);
  assert.match(manager, /submitting\.current \|\| busy \|\| editing/);
  assert.match(manager, /history\.replaceState\(null, "", window\.location\.pathname\)/);
});
