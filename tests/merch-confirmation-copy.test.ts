import test from "node:test";
import assert from "node:assert/strict";
import { renderCustomerMail } from "../src/lib/customer-mail-catalog";

test("merchandise payment confirmation never mentions an expired dispatch date", () => {
  const message = renderCustomerMail("merch_purchase", {
    to: "client@example.invalid",
    productName: "Camiseta Imperial",
    size: "L",
  });
  assert.equal(message.subject, "Hemos recibido tu pedido");
  assert.match(message.text, /Te informaremos sobre la preparación y el envío/);
  assert.match(message.html, /Te informaremos sobre la preparación y el envío/);
  assert.doesNotMatch(message.text, /13 de octubre de 2026/);
  assert.doesNotMatch(message.html, /13 de octubre de 2026/);
});
