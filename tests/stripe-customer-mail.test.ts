import test from "node:test";
import assert from "node:assert/strict";
import { planStripeCustomerMail, queueStripeCustomerMail, drainStripeCustomerMail, stripeCustomerMailActiveForEvent, type StripeCustomerMailReadClient, type StripeCustomerMailDependencies, type StripeCustomerMailEvent } from "../src/lib/stripe-customer-mail";

const now = Date.parse("2026-11-12T10:00:00Z");
const event: StripeCustomerMailEvent = { id: "evt_fixture_paid", type: "invoice.paid", created: now / 1000, livemode: false, data: { object: { id: "in_fixture" } } };
const invoice = { id: "in_fixture", status: "paid", number: "FACTURA-12345678", customer_email: "customer@example.invalid", customer_name: "<script>cliente</script>", amount_paid: 3500, currency: "eur", hosted_invoice_url: "https://invoice.stripe.com/i/fixture" };
function reader(): StripeCustomerMailReadClient {
  const unexpected = async () => { throw Error("UNEXPECTED_FIXTURE_READ"); };
  return { invoices: { retrieve: async () => invoice }, checkout: { sessions: { retrieve: unexpected } }, paymentIntents: { retrieve: unexpected }, charges: { retrieve: unexpected }, refunds: { retrieve: unexpected }, subscriptions: { retrieve: unexpected }, customers: { retrieve: unexpected }, creditNotes: { retrieve: unexpected } };
}

test("disabled or pre-cutover billing mail performs no provider reads, queue writes or sends", async () => {
  const api = reader();
  api.invoices.retrieve = async () => { throw Error("PROVIDER_MUST_NOT_BE_READ"); };
  const deps: Partial<StripeCustomerMailDependencies> = { runtime: async () => ({ enabled: false, starts_at: null, livemode: false }), now: () => now, rpc: async () => { throw Error("MUST_NOT_WRITE"); }, send: async () => { throw Error("MUST_NOT_SEND"); } };
  assert.equal((await queueStripeCustomerMail(event, api, deps)).enabled, false);
  assert.equal((await drainStripeCustomerMail(1, api, deps)).enabled, false);
  assert.equal(await stripeCustomerMailActiveForEvent(event, { ...deps, runtime: async () => ({ enabled: true, starts_at: new Date(now + 1000).toISOString(), livemode: false }) }), false);
});

test("both paid invoice events coalesce by invoice and render escaped corporate content", async () => {
  const first = (await planStripeCustomerMail(event, reader(), now))[0];
  const second = (await planStripeCustomerMail({ ...event, id: "evt_fixture_success", type: "invoice.payment_succeeded" }, reader(), now))[0];
  assert.equal(first.key, second.key);
  assert.match(first.message.html, /data-imperio-email-layout="pergamino-v1"/);
  assert.doesNotMatch(first.message.html, /<script>/);
  assert.match(first.message.text, /35,00/);
  assert.match(first.message.text, /FACTURA-12345678/);
});

test("an uncertain acknowledgement retries the frozen message with exactly the same provider key", async () => {
  let job: any, completed = false, attempts = 0;
  const sent: { key: string; payload: string }[] = [];
  const deps: Partial<StripeCustomerMailDependencies> = {
    runtime: async () => ({ enabled: true, starts_at: new Date(now - 3600000).toISOString(), livemode: false }), now: () => now,
    secret: () => "synthetic-fixture-encryption-secret-minimum-32-characters",
    transform: message => ({ ...message, to: "sink@example.invalid" }),
    checkDelivery: message => { assert.equal(message.to, "sink@example.invalid"); },
    rpc: async (name, args: any) => {
      if (name === "enqueue_stripe_customer_mail") {
        job = { id: "00000000-0000-4000-8000-000000000011", claim_id: "00000000-0000-4000-8000-000000000012", key: args.p_key, kind: args.p_kind, recipient: args.p_recipient, subject: args.p_subject, payload_digest: args.p_payload_digest, encrypted_message: args.p_encrypted_message, livemode: false };
        assert.ok(!job.encrypted_message.includes("customer@example.invalid"));
        return true;
      }
      if (name === "claim_stripe_customer_mail") return completed ? [] : [job];
      if (name === "stripe_customer_mail_can_send") return true;
      if (name === "complete_stripe_customer_mail") { attempts++; if (attempts === 1) return false; completed = true; return true; }
      if (name === "fail_stripe_customer_mail") return true;
      throw Error("UNEXPECTED_FIXTURE_RPC");
    },
    send: async (message, key) => { sent.push({ key, payload: JSON.stringify(message) }); return { data: { id: "provider_fixture" }, error: null }; },
  };
  assert.equal((await queueStripeCustomerMail(event, reader(), deps)).enqueued, 1);
  assert.equal((await drainStripeCustomerMail(1, reader(), deps)).failed, 1);
  assert.equal((await drainStripeCustomerMail(1, reader(), deps)).sent, 1);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);
});
