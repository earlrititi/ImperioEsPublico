import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  permanentBounce,
  resendClickUrl,
  resendDedupeKey,
  resendDeliveryState,
  resendEventType,
  resendMessageId,
  resendOccurredAt,
  resendRecipient,
  safeEventDetail,
  suppressionReason,
  verifySvixSignature,
} from "../src/lib/resend-webhook";

const secret = `whsec_${Buffer.from("imperio-test-secret").toString("base64")}`;

function signed(body: string, id = "msg_1", timestamp?: string) {
  const seconds = timestamp ?? String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${seconds}.${body}`).digest("base64");
  return { id, timestamp: seconds, signature: `v1,${signature}` };
}

test("Svix signature is verified with the raw body and rejected when stale or tampered", () => {
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const headers = signed(body);
  assert.equal(verifySvixSignature({ headers, body, secret }), true);
  assert.equal(verifySvixSignature({ headers, body: `${body} `, secret }), false);
  assert.equal(verifySvixSignature({ headers: { ...headers, signature: "v1,AAAA" }, body, secret }), false);
  const stale = signed(body, "msg_1", "1000000000");
  assert.equal(verifySvixSignature({ headers: stale, body, secret, now: Date.now() }), false);
  assert.equal(verifySvixSignature({ headers: { id: null, timestamp: null, signature: null }, body, secret }), false);
});

test("Resend event names map to the nine persisted event types and unknown events are ignored", () => {
  assert.equal(resendEventType("email.sent"), "sent");
  assert.equal(resendEventType("email.delivered"), "delivered");
  assert.equal(resendEventType("email.delivery_delayed"), "delivery_delayed");
  assert.equal(resendEventType("email.opened"), "opened");
  assert.equal(resendEventType("email.clicked"), "clicked");
  assert.equal(resendEventType("email.bounced"), "bounced");
  assert.equal(resendEventType("email.complained"), "complained");
  assert.equal(resendEventType("email.failed"), "failed");
  assert.equal(resendEventType("email.suppressed"), "suppressed");
  assert.equal(resendEventType("email.unknown"), null);
  assert.equal(resendEventType(42), null);
});

test("payload extraction only accepts safe message ids and normalised recipients", () => {
  assert.equal(resendMessageId({ email_id: "abc" }), "abc");
  assert.equal(resendMessageId({ id: "def" }), "def");
  assert.equal(resendMessageId({ message_id: "x".repeat(201) }), "");
  assert.equal(resendRecipient({ to: ["Person@Example.com"] }), "person@example.com");
  assert.equal(resendRecipient({ to: "not-an-email" }), "");
  assert.equal(resendRecipient({}), "");
});

test("event timestamps fall back safely and dedupe keys stay bounded", () => {
  const fallback = new Date("2026-11-09T10:00:00.000Z");
  assert.equal(resendOccurredAt({ created_at: "2026-11-09T09:00:00.000Z" }, fallback), "2026-11-09T09:00:00.000Z");
  assert.equal(resendOccurredAt({ created_at: "not-a-date" }, fallback), fallback.toISOString());
  assert.equal(resendDedupeKey({ svixId: "msg_1", eventType: "opened", messageId: "abc", occurredAt: "2026-11-09T09:00:00.000Z" }), "svix:msg_1");
  const long = resendDedupeKey({ svixId: "x".repeat(400), eventType: "opened", messageId: "abc", occurredAt: "2026-11-09T09:00:00.000Z" });
  assert.match(long, /^sha256:[a-f0-9]{64}$/);
});

test("delivery receipts only confirm delivery on a delivered event", () => {
  assert.deepEqual(resendDeliveryState("delivered"), { status: "delivered", confirmed: true });
  assert.equal(resendDeliveryState("bounced")?.confirmed, false);
  assert.equal(resendDeliveryState("complained")?.confirmed, false);
  assert.equal(resendDeliveryState("failed")?.confirmed, false);
  assert.equal(resendDeliveryState("opened"), null);
  assert.equal(resendDeliveryState("clicked"), null);
});

test("permanent bounces and complaints become suppressions; soft bounces do not", () => {
  assert.equal(permanentBounce({ bounce: { type: "Permanent" } }), true);
  assert.equal(permanentBounce({ bounce: { type: "hard" } }), true);
  assert.equal(permanentBounce({ bounce: { type: "Transient" } }), false);
  assert.equal(suppressionReason("bounced", { bounce: { type: "Permanent" } }), "provider_bounced");
  assert.equal(suppressionReason("bounced", { bounce: { type: "Transient" } }), null);
  assert.equal(suppressionReason("complained", {}), "provider_complained");
  assert.equal(suppressionReason("opened", {}), null);
});

test("click details keep the link but never persist arbitrary payloads", () => {
  assert.equal(resendClickUrl({ click: { link: "https://imperioes.com/tienda" } }), "https://imperioes.com/tienda");
  assert.equal(resendClickUrl({ click: { link: "x".repeat(2049) } }), null);
  assert.deepEqual(safeEventDetail("bounced", { bounce: { type: "Permanent", subType: "General" } }), {
    bounce_type: "Permanent",
    bounce_subtype: "General",
  });
  assert.deepEqual(safeEventDetail("clicked", { click: { link: "https://imperioes.com/tienda" } }), {
    url: "https://imperioes.com/tienda",
  });
  assert.deepEqual(safeEventDetail("opened", { secret: "ignored" }), {});
  assert.deepEqual(safeEventDetail("failed", { reason: "x".repeat(300) }), { reason: "x".repeat(200) });
});
