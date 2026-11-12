import test from "node:test";
import assert from "node:assert/strict";
import {
  createCorporateMailClient,
  sendCorporateMail,
  type CorporateMailClient,
  type CorporateMailMessage,
  type CorporateMailOptions,
  type CorporateMailResponse,
} from "../src/lib/corporate-mail-transport";
import { prepareCorporateEmail } from "../src/lib/corporate-email";
import { transactionalTestMessage } from "../src/lib/mail-delivery";

const accepted: CorporateMailResponse = {
  data: { id: "provider-fixture" },
  error: null,
  headers: { "x-request-id": "fixture" },
};
const message = () => ({
  from: "Imperio <sender@example.invalid>",
  to: "reader@example.invalid",
  replyTo: "support@example.invalid",
  subject: "Tu pedido",
  text: "Pedido 42 confirmado.",
  html: "<p>Pedido 42 confirmado.</p>",
});

test("gateway renders once while preserving envelope, attachments, headers and provider options", async () => {
  const payload = {
    ...message(),
    cc: ["copy@example.invalid"],
    bcc: "audit@example.invalid",
    attachments: [
      { filename: "receipt.pdf", content: Buffer.from("fixture-pdf") },
    ],
    headers: {
      "List-Unsubscribe": "<https://example.invalid/baja?token=fixture>",
    },
    tags: [{ name: "kind", value: "receipt" }],
    scheduledAt: "2030-01-01T00:00:00.000Z",
  };
  const options: CorporateMailOptions = {
    idempotencyKey: "existing-order-key",
    headers: { "x-fixture": "preserve" },
    query: { source: "fixture" },
  };
  const client: CorporateMailClient = {
    emails: {
      async send(sent, suppliedOptions) {
        assert.equal(sent.from, payload.from);
        assert.equal(sent.to, payload.to);
        assert.equal(sent.replyTo, payload.replyTo);
        assert.equal(sent.cc, payload.cc);
        assert.equal(sent.bcc, payload.bcc);
        assert.equal(sent.subject, payload.subject);
        assert.equal(sent.attachments, payload.attachments);
        assert.equal(sent.headers, payload.headers);
        assert.equal(sent.tags, payload.tags);
        assert.equal(sent.scheduledAt, payload.scheduledAt);
        assert.equal(suppliedOptions, options);
        assert.equal(
          sent.html?.match(/data-imperio-email-layout=/g)?.length,
          1,
        );
        assert.ok(sent.text?.startsWith(payload.text));
        return accepted;
      },
    },
  };
  assert.equal(await sendCorporateMail(client, payload, options), accepted);
  assert.equal(
    payload.html,
    "<p>Pedido 42 confirmado.</p>",
    "the caller-owned input stays unchanged",
  );
});

test("an already rendered message reaches the provider unchanged", async () => {
  const payload = prepareCorporateEmail(message());
  const client: CorporateMailClient = {
    emails: {
      async send(sent) {
        assert.equal(sent, payload);
        return accepted;
      },
    },
  };
  assert.equal(await sendCorporateMail(client, payload), accepted);
});

test("legacy retry snapshots retain their exact object, text-only body and idempotency options", async () => {
  const payload: CorporateMailMessage = {
    from: "Legacy Sender <old@example.invalid>",
    to: "old-reader@example.invalid",
    replyTo: "old-support@example.invalid",
    subject: "Mensaje anterior",
    text: "Texto histórico sin pergamino.",
    headers: { "X-Legacy": "retained" },
  };
  const options = { idempotencyKey: "old-provider-key" };
  const before = JSON.stringify(payload);
  const client: CorporateMailClient = {
    emails: {
      async send(sent, suppliedOptions) {
        assert.equal(sent, payload);
        assert.equal(sent.html, undefined);
        assert.equal(suppliedOptions, options);
        return accepted;
      },
    },
  };
  await sendCorporateMail(client, payload, options, { preserveSnapshot: true });
  assert.equal(JSON.stringify(payload), before);
});

test("validation rejects unsafe or empty snapshots before calling the provider", () => {
  let calls = 0;
  const client: CorporateMailClient = {
    emails: {
      async send() {
        calls++;
        return accepted;
      },
    },
  };
  for (const payload of [
    { ...message(), text: "", html: "" },
    { ...message(), html: "<script>bad()</script><p>Texto</p>" },
  ]) {
    assert.throws(() =>
      sendCorporateMail(client, payload, undefined, { preserveSnapshot: true }),
    );
  }
  assert.equal(calls, 0);
});

test("provider response errors and rejected promises pass through without being hidden", async () => {
  const rejected: CorporateMailResponse = {
    data: null,
    error: {
      name: "rate_limit_exceeded",
      message: "Fixture rejection",
      statusCode: 429,
    },
    headers: { "retry-after": "2" },
  };
  const client: CorporateMailClient = {
    emails: {
      async send() {
        return rejected;
      },
    },
  };
  assert.equal(await sendCorporateMail(client, message()), rejected);
  const error = new Error("fixture-network-failure");
  const failing: CorporateMailClient = {
    emails: {
      async send() {
        throw error;
      },
    },
  };
  await assert.rejects(
    sendCorporateMail(failing, message()),
    (candidate) => candidate === error,
  );
});

test("test destination rewriting happens before rendering without changing request options", async () => {
  const redirected = transactionalTestMessage(
    { ...message(), cc: "copy@example.invalid", bcc: "hidden@example.invalid" },
    "sink@example.invalid",
    "sk_test_fixture",
  );
  const options = { idempotencyKey: "test-existing-key" };
  const client: CorporateMailClient = {
    emails: {
      async send(sent, suppliedOptions) {
        assert.equal(sent.to, "sink@example.invalid");
        assert.equal(sent.cc, undefined);
        assert.equal(sent.bcc, undefined);
        assert.match(sent.subject ?? "", /^\[TEST - SIN COBRO REAL\]/);
        assert.match(sent.html ?? "", /<title>\[TEST - SIN COBRO REAL\]/);
        assert.equal(suppliedOptions, options);
        return accepted;
      },
    },
  };
  await sendCorporateMail(client, redirected, options);
});

test("factory preserves the SDK sender when its public send method is decorated", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), "https://api.resend.com/emails");
    assert.equal(
      new Headers(init?.headers).get("idempotency-key"),
      "factory-existing-key",
    );
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.from, message().from);
    assert.equal(payload.reply_to, message().replyTo);
    assert.match(payload.html, /data-imperio-email-layout="pergamino-v1"/);
    return new Response(JSON.stringify({ id: "factory-fixture" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const client = createCorporateMailClient("re_transport_fixture");
    client.emails.send = (payload, options) =>
      sendCorporateMail(client, payload, options);
    const response = await client.emails.send(message(), {
      idempotencyKey: "factory-existing-key",
    });
    assert.equal(response.data?.id, "factory-fixture");
    assert.equal(calls, 1);
    assert.equal(
      typeof client.emails.get,
      "function",
      "receipt readers remain available",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
