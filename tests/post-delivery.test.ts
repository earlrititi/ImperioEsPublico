import test from "node:test";
import assert from "node:assert/strict";
import { deliveryEventInput, deliveryMessageEligible, postDeliveryDelay, receiptCapability, verifyReceiptCapability, type DeliveryOrder } from "../src/lib/post-delivery";
import { postDeliveryMessage, runPostDelivery } from "../src/lib/post-delivery-worker";
import { captureDeliveryDispute } from "../src/lib/commerce-disputes";

const secret = "test-only-secret-for-receipt-capability-123456789";
const id = "1503495a-8bab-4b1f-9cb8-ce86f4446e87";
const paid: DeliveryOrder = { status: "PAID", paid_at: "2026-01-01T00:00:00Z", carrier_delivered_at: null, customer_received_at: null,
  delivery_issue_at: null, delivery_returned_at: null };

test("payment, tracking and shipment never establish delivery or start loyalty", () => {
  for (const status of ["PAID", "READY_FOR_FULFILLMENT", "PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"]) {
    assert.equal(deliveryMessageEligible({ ...paid, status }, "delivery_check", true), false);
    assert.equal(deliveryMessageEligible({ ...paid, status }, "post_delivery_loyalty", true), false);
  }
});
test("receipt and logistics are independent and a customer-first confirmation prevents the check", () => {
  const delivered = { ...paid, carrier_delivered_at: "2026-01-03T10:00:00Z" };
  assert.equal(deliveryMessageEligible(delivered, "delivery_check", false), true);
  assert.equal(deliveryMessageEligible(delivered, "post_delivery_loyalty", true), false);
  const received = { ...paid, customer_received_at: "2026-01-02T10:00:00Z" };
  assert.equal(deliveryMessageEligible(received, "delivery_check", true), false);
  assert.equal(deliveryMessageEligible(received, "post_delivery_loyalty", false), false);
  assert.equal(deliveryMessageEligible(received, "post_delivery_loyalty", true), true);
  assert.equal(deliveryMessageEligible({ ...delivered, ...received }, "delivery_check", true), false);
});
test("support, physical returns and any refund stop nonessential post-delivery mail", () => {
  const delivered = { ...paid, carrier_delivered_at: "2026-01-03T10:00:00Z", customer_received_at: "2026-01-03T11:00:00Z" };
  for (const stopped of [{ status: "REFUNDED" }, { status: "CANCELLED" }, { delivery_issue_at: "2026-01-03T12:00:00Z" },
    { delivery_returned_at: "2026-01-04T12:00:00Z" }, { delivery_disputed_at: "2026-01-04T12:00:00Z" }, { refunded_amount: 1 }]) {
    assert.equal(deliveryMessageEligible({ ...delivered, ...stopped }, "delivery_check", true), false);
    assert.equal(deliveryMessageEligible({ ...delivered, ...stopped }, "post_delivery_loyalty", true), false);
  }
});
test("carrier evidence is mandatory and package numbers/future dates are checked", () => {
  const event = { kind: "carrier_delivered", packageCount: 2, packageIndex: 1, occurredAt: "2026-01-03T10:00:00Z", evidence: "private-ticket-15" };
  assert.equal(deliveryEventInput(event).packageCount, 2);
  assert.throws(() => deliveryEventInput({ ...event, evidence: "" }), /DELIVERY_EVIDENCE_REQUIRED/);
  for (const change of [{ packageIndex: 3 }, { packageIndex: 0 }, { packageCount: 51 }, { packageCount: 1.5 }, { occurredAt: "invalid" },
    { occurredAt: new Date(Date.now() + 86400000).toISOString() }, { evidence: "<script>" }]) assert.throws(() => deliveryEventInput({ ...event, ...change }));
  assert.throws(() => deliveryEventInput(event, true));
  assert.doesNotThrow(() => deliveryEventInput({ ...event, kind: "customer_received", evidence: "" }, true));
});
test("receipt capabilities resist alteration, expiry and cross-purpose use", () => {
  const now = Date.now(), expires = now + 86400000, token = receiptCapability(id, expires, secret);
  assert.deepEqual(verifyReceiptCapability(token, secret, now), { jobId: id, expires: new Date(expires).toISOString() });
  assert.throws(() => verifyReceiptCapability(token, secret, expires), /NOT_FOUND/);
  assert.throws(() => verifyReceiptCapability(token, `${secret}-wrong`, now), /NOT_FOUND/);
  assert.throws(() => verifyReceiptCapability(token.replace(id, "2503495a-8bab-4b1f-9cb8-ce86f4446e87"), secret, now));
  assert.throws(() => verifyReceiptCapability(`${token}.extra`, secret, now));
  assert.throws(() => verifyReceiptCapability(receiptCapability(id, now + 16 * 86400000, secret), secret, now));
});
test("service receipt check contains support and no loyalty promotion", () => {
  const message = postDeliveryMessage({ id, order_id: id, kind: "delivery_check", recipient: "test@example.invalid", order_number: "TEST-ORDER",
    token_expires_at: new Date(Date.now() + 86400000).toISOString(), claim_id: id, template_digest: null }, secret);
  assert.match(message.text, /comunicar una incidencia/);
  assert.match(message.text, /\/pedidos\/recepcion#/);
  assert.doesNotMatch(message.text, /descuento|oferta|reseña|fotografía|novedades|comunidad/i);
  assert.ok(!("headers" in message));
  assert.match(message.html, /data-imperio-email-layout="pergamino-v1"/);
});
test("post-delivery runtime is disabled without explicit authorization date and flags", async () => {
  const old = process.env.POST_DELIVERY_ENABLED;
  process.env.POST_DELIVERY_ENABLED = "false";
  try { assert.deepEqual(await runPostDelivery(), { disabled: true, queued: 0, sent: 0, cancelled: 0, failed: 0 }); }
  finally { if (old === undefined) delete process.env.POST_DELIVERY_ENABLED; else process.env.POST_DELIVERY_ENABLED = old; }
  assert.equal(postDeliveryDelay("", 48), 48);
  assert.throws(() => postDeliveryDelay("0", 48));
  assert.throws(() => postDeliveryDelay("337", 48));
});
test("signed-handler dispute processing refetches the provider and propagates failures for retry", async () => {
  const calls: unknown[] = [];
  assert.equal(await captureDeliveryDispute("du_fixture", async id => {
    calls.push(id); return { id, created: 1767225600, payment_intent: { id: "pi_fixture_current" } };
  }, async args => { calls.push(args); }), true);
  assert.deepEqual(calls, ["du_fixture", { p_intent: "pi_fixture_current", p_dispute: "du_fixture", p_at: "2026-01-01T00:00:00.000Z" }]);
  await assert.rejects(captureDeliveryDispute("du_fixture", async () => { throw Error("PROVIDER_UNAVAILABLE"); }, async () => {}), /PROVIDER_UNAVAILABLE/);
  await assert.rejects(captureDeliveryDispute("du_fixture", async () => ({ id: "du_other", created: 1767225600, payment_intent: "pi_fixture_current" }), async () => {}));
  let saved = false;
  assert.equal(await captureDeliveryDispute("du_fixture", async id => ({ id, created: 1767225600, payment_intent: null }), async () => { saved = true; }), false);
  assert.equal(saved, false);
});
