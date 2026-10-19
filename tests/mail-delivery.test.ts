import test from "node:test";
import assert from "node:assert/strict";
import { assertMailRecipient, transactionalTestMessage } from "../src/lib/mail-delivery";

test("Test transport only accepts its explicit sink, including saved retry payloads", () => {
  assert.doesNotThrow(() => assertMailRecipient({ to: "sink@resend.dev" }, "test", "sink@resend.dev"));
  assert.doesNotThrow(() => assertMailRecipient({ to: ["SINK@resend.dev"] }, "test", "sink@resend.dev"));
  for (const message of [{ to: "customer@example.invalid" }, { to: ["sink@resend.dev", "other@example.invalid"] },
    { to: "sink@resend.dev", cc: "other@example.invalid" }, { to: "sink@resend.dev", bcc: ["other@example.invalid"] }, { to: [] }]) {
    assert.throws(() => assertMailRecipient(message, "test", "sink@resend.dev"), /EMAIL_TEST_RECIPIENT_MISMATCH/);
  }
  assert.throws(() => assertMailRecipient({ to: "sink@resend.dev" }, "test", ""), /EMAIL_TEST_RECIPIENT_MISMATCH/);
  assert.doesNotThrow(() => assertMailRecipient({ to: "customer@example.invalid" }, "live", ""));
});

test("explicit transactional Test redirect replaces every recipient and never accepts a Live key", () => {
  const message = { to: ["buyer@example.invalid"], cc: "copy@example.invalid", bcc: ["hidden@example.invalid"],
    subject: "Suscripcion activa", text: "Synthetic Test content" };
  assert.equal(transactionalTestMessage(message, "", "sk_live_fixture"), message);
  const redirected = transactionalTestMessage(message, "SINK@resend.dev", "sk_test_fixture");
  assert.equal(redirected.to, "sink@resend.dev"); assert.equal(redirected.cc, undefined); assert.equal(redirected.bcc, undefined);
  assert.match(redirected.subject, /^\[TEST - SIN COBRO REAL\]/); assert.equal(redirected.text, message.text);
  assert.deepEqual(message.to, ["buyer@example.invalid"]);
  assert.match(transactionalTestMessage(message, "sink@resend.dev", "sk_test_fixture", "00000000-0000-4000-8000-000000000001").subject, /\[run:00000000-0000-4000-8000-000000000001\]/);
  assert.throws(() => transactionalTestMessage(message, "sink@resend.dev", "sk_test_fixture", "bad\nrun"));
  const template = transactionalTestMessage({ to: "buyer@example.invalid", template: { id: "fixture" } }, "sink@resend.dev", "sk_test_fixture");
  assert.equal(template.template.id, "fixture");
  for (const key of ["sk_live_fixture", "rk_live_fixture", "", "unknown"]) {
    assert.throws(() => transactionalTestMessage(message, "sink@resend.dev", key), /TEST_CONFIGURATION_INVALID/);
  }
  assert.throws(() => transactionalTestMessage(message, "sink@resend.dev\nbcc:other@example.invalid", "sk_test_fixture"));
});
