import assert from "node:assert/strict";
import { Socket } from "node:net";
import fs from "node:fs";
import { parseEnv } from "node:util";
import Stripe from "../.vercel/output/functions/_render.func/node_modules/stripe/esm/stripe.esm.node.js";

// All outbound transports are replaced before importing the compiled application.
Socket.prototype.connect = () => { throw new Error("Network disabled in commerce fixtures"); };
Object.assign(process.env, {
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  PUBLIC_SITE_URL: "https://imperioes.com",
  PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
  RATE_LIMIT_SECRET: "fixture-rate-limit",
  RESEND_API_KEY: "re_fixture",
  RESEND_FROM_EMAIL: "fixture@example.invalid",
  STRIPE_ES_VAT_RATE_ID: "txr_fixture",
});
const plans = [
  ["arcabucero-monthly", "arcabucero", "month", "STRIPE_PRICE_ARCABUCERO_MONTHLY"],
  ["arcabucero-annual", "arcabucero", "year", "STRIPE_PRICE_ARCABUCERO_ANNUAL"],
  ["maestre-campo-monthly", "maestre_campo", "month", "STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY"],
  ["maestre-campo-annual", "maestre_campo", "year", "STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL"],
];
for (const [slug, , , name] of plans) process.env[name] = `price_fixture_${slug}`;
let interval = "month";
let live = false;
let active = true;
let sessionCount = 0;
let expiredCount = 0;
let checkoutParams;
let consentFailure = false;
let ledgerFailure = false;
let subscriptionFailure = false;
let adminEmailFailure = false;
let consentRows = [];
let subscriptionRows = [];
let currentSubscription;
let existingSubscription = null;
let vatOverrides = {};
let priceOverride = {};
const emailRows = [];
const events = new Map();
const userId = "00000000-0000-4000-8000-000000000001";
Stripe.StripeResource.prototype._makeRequest = async (method, pathname, params, options) => {
  if (method === "GET" && pathname.startsWith("/v1/prices/")) {
    const amount = pathname.includes("arcabucero") ? (interval === "month" ? 199 : 1799) : (interval === "month" ? 399 : 3799);
    return { id: pathname.split("/").at(-1), active, livemode: live, type: "recurring",
      currency: "eur", unit_amount: amount, recurring: { interval, interval_count: 1 }, ...priceOverride };
  }
  if (method === "GET" && pathname === "/v1/tax_rates/txr_fixture") {
    return { id: "txr_fixture", active: true, inclusive: true, percentage: 21, country: "ES", livemode: live, ...vatOverrides };
  }
  if (method === "POST" && pathname === "/v1/checkout/sessions") {
    sessionCount++;
    checkoutParams = params;
    assert.ok(options.idempotencyKey.startsWith("checkout_"));
    return { id: "cs_test_fixture", url: "https://checkout.stripe.com/fixture" };
  }
  if (method === "POST" && pathname === "/v1/checkout/sessions/cs_test_fixture/expire") {
    expiredCount++;
    return { id: "cs_test_fixture", status: "expired" };
  }
  if (method === "GET" && pathname === "/v1/customers/cus_fixture") {
    return { id: "cus_fixture", email: null, livemode: live, metadata: {} };
  }
  if (method === "GET" && pathname === "/v1/subscriptions/sub_fixture") return currentSubscription;
  throw new Error(`Unexpected Stripe fixture request: ${method} ${pathname}`);
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
globalThis.fetch = async (input, options) => {
  const request = input instanceof Request ? input : new Request(input, options);
  const url = new URL(request.url);
  const body = request.method === "GET" ? null : await request.json();
  switch (url.pathname) {
    case "/auth/v1/user": return json({ id: userId, email: "fixture@example.invalid", aud: "authenticated", role: "authenticated" });
    case "/emails":
      assert.equal(url.hostname, "api.resend.com");
      if (adminEmailFailure && body.to.includes("earlrititi@gmail.com")) return json({ name: "application_error", message: "fixture email failure" }, 500);
      emailRows.push(body);
      return json({ id: "email_fixture" });
    case "/rest/v1/rpc/consume_rate_limit": return json(true);
    case "/rest/v1/legal_consents":
      if (consentFailure) return json({ message: "fixture consent failure" }, 503);
      consentRows = body;
      return new Response(null, { status: 201 });
    case "/rest/v1/subscriptions":
      if (request.method === "GET") return json(existingSubscription ? [existingSubscription] : []);
      if (subscriptionFailure) return json({ message: "fixture subscription failure" }, 503);
      subscriptionRows.push(body);
      return json({ id: "fixture", ...body });
    case "/rest/v1/stripe_webhook_events": {
      if (ledgerFailure) return json({ message: "fixture ledger failure" }, 503);
      const id = body?.event_id ?? url.searchParams.get("event_id")?.replace(/^eq\./, "");
      if (request.method === "POST") {
        if (events.has(id)) return json({ code: "23505" }, 409);
        events.set(id, { ...body, attempts: 1, received_at: new Date().toISOString() });
        return new Response(null, { status: 201 });
      }
      if (request.method === "GET") return json(events.get(id));
      if (request.method === "PATCH") {
        Object.assign(events.get(id), body);
        return request.headers.get("prefer")?.includes("return=representation")
          ? json({ event_id: id }) : new Response(null, { status: 204 });
      }
      break;
    }
  }
  throw new Error(`Unexpected fixture request: ${request.method} ${url.pathname}`);
};

const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
let cases = 0;
const local = parseEnv(fs.readFileSync(".env.local", "utf8"));
const project = new URL(local.PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const expires = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp: expires, role: "authenticated" })}.fixture`;
const cookie = `sb-${project}-auth-token=base64-${encode({ access_token: token,
  refresh_token: "fixture", token_type: "bearer", expires_at: expires, expires_in: 3600,
  user: { id: userId, email: "fixture@example.invalid" } })}`;
async function checkout(plan, extra = {}, authenticated = false) {
  return app.fetch(new Request("https://imperioes.com/api/create-checkout-session", {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "https://imperioes.com", ...(authenticated ? { cookie } : {}) },
    body: JSON.stringify({ plan, requestId: crypto.randomUUID(), anonymousId: crypto.randomUUID(),
      consents: { terms: true, privacy: true, immediateAccess: true, withdrawalAcknowledgement: true }, ...extra }),
  }));
}
for (const [slug, plan, billingInterval] of plans) {
  interval = billingInterval;
  live = true;
  const before = sessionCount;
  const blocked = await checkout(slug);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, "LIVE_CHECKOUT_NOT_ENABLED");
  assert.equal(sessionCount, before, "Live request must not create a session");
  const page = await app.fetch(new Request(`https://imperioes.com/checkout/${slug}`));
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /La contratacion todavia no esta abierta/);
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled/);
  cases += 2;

  live = false;
  const result = await checkout(slug);
  assert.equal(result.status, 200, await result.text());
  assert.equal(checkoutParams.mode, "subscription");
  assert.deepEqual(Object.keys(checkoutParams.metadata), ["termsVersion"]);
  assert.equal(checkoutParams.subscription_data.metadata.plan, plan);
  assert.equal(checkoutParams.subscription_data.metadata.billingInterval, billingInterval);
  assert.equal(checkoutParams.line_items[0].quantity, 1);
  assert.deepEqual(checkoutParams.subscription_data.default_tax_rates, ["txr_fixture"]);
  assert.deepEqual(checkoutParams.automatic_tax, { enabled: false });
  assert.equal(checkoutParams.shipping_address_collection, undefined);
  assert.equal(checkoutParams.tax_id_collection, undefined);
  assert.equal(checkoutParams.phone_number_collection, undefined);
  assert.equal(consentRows.length, 4);
  assert.ok(consentRows.every(row => row.context_id === "cs_test_fixture" && row.accepted));
  cases++;
}
interval = "month";
const beforeInvalidTax = sessionCount;
for (const overrides of [{ inclusive: false }, { percentage: 20 }, { livemode: true }, { active: false }]) {
  vatOverrides = overrides;
  assert.equal((await checkout("arcabucero-monthly")).status, 409);
  cases++;
}
vatOverrides = {};
delete process.env.STRIPE_ES_VAT_RATE_ID;
assert.equal((await checkout("arcabucero-monthly")).status, 409);
process.env.STRIPE_ES_VAT_RATE_ID = "txr_fixture";
assert.equal(sessionCount, beforeInvalidTax, "Invalid or missing tax must not create sessions");
priceOverride = { unit_amount: 1 };
assert.equal((await checkout("arcabucero-monthly")).status, 409);
priceOverride = {};
existingSubscription = { id: "fixture", user_id: userId, stripe_customer_id: "cus_fixture", plan: "arcabucero", status: "canceled" };
assert.equal((await checkout("arcabucero-monthly", {}, true)).status, 200);
assert.equal(checkoutParams.customer, "cus_fixture");
assert.equal(checkoutParams.customer_email, undefined);
assert.equal(checkoutParams.billing_address_collection, "required");
assert.deepEqual(checkoutParams.customer_update, { address: "auto", name: "auto" });
existingSubscription.status = "active";
const beforeActive = sessionCount;
assert.equal((await checkout("arcabucero-monthly", {}, true)).status, 409);
assert.equal(sessionCount, beforeActive);
existingSubscription = null;
cases += 4;
assert.equal((await checkout("arcabucero-monthly", { consents: {} })).status, 400);
assert.equal((await checkout("unknown-plan")).status, 400);
assert.equal((await checkout(null, { product: "camiseta-imperial" })).status, 409);
active = false;
assert.equal((await checkout("arcabucero-monthly")).status, 409);
active = true;
consentFailure = true;
assert.equal((await checkout("arcabucero-monthly")).status, 503);
assert.equal(expiredCount, 1, "Consent persistence failure must expire the session");
consentFailure = false;
cases += 5;

const signingClient = new Stripe("sk_test_fixture");
async function webhook(type, object, id = `evt_fixture_${crypto.randomUUID()}`, signed = true, eventLive = false) {
  const payload = JSON.stringify({ id, object: "event", type, livemode: eventLive, data: { object } });
  const headers = { "Content-Type": "application/json" };
  if (signed) headers["stripe-signature"] = signingClient.webhooks.generateTestHeaderString({
    payload, secret: "whsec_fixture",
  });
  return app.fetch(new Request("https://imperioes.com/api/stripe-webhook", {
    method: "POST", headers, body: payload,
  }));
}
assert.equal((await webhook("customer.subscription.updated", {}, undefined, false)).status, 400);
const tampered = new Request("https://imperioes.com/api/stripe-webhook", {
  method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=invalid" }, body: "{}",
});
assert.equal((await app.fetch(tampered)).status, 400);
assert.equal(events.size, 0, "Unsigned events must never touch the ledger");
assert.equal((await webhook("customer.subscription.updated", {}, undefined, true, true)).status, 400);
assert.equal(events.size, 0, "Cross-mode events must not touch the ledger");
assert.equal((await webhook("customer.created", {})).status, 200);
assert.equal(events.size, 0, "Unused event types must not be copied into the ledger");
cases += 2;
const busyId = "evt_fixture_busy";
events.set(busyId, { event_id: busyId, status: "processing", attempts: 1, received_at: new Date().toISOString() });
assert.equal((await webhook("customer.subscription.updated", {}, busyId)).status, 503);
cases++;
cases += 2;
for (const [, plan, billingInterval] of plans) {
  currentSubscription = { id: "sub_fixture", customer: "cus_fixture", status: "active",
    metadata: { plan, billingInterval, userId }, cancel_at_period_end: true,
    items: { data: [{ current_period_start: 1700000000, current_period_end: 1900000000,
      price: { id: "price_fixture", recurring: { interval: billingInterval } } }] } };
  const id = `evt_fixture_${crypto.randomUUID()}`;
  assert.equal((await webhook("customer.subscription.updated", currentSubscription, id)).status, 200);
  assert.equal(subscriptionRows.at(-1).plan, plan);
  assert.equal(subscriptionRows.at(-1).billing_interval, billingInterval);
  assert.equal(subscriptionRows.at(-1).status, "active");
  assert.equal(subscriptionRows.at(-1).cancel_at_period_end, true);
  assert.equal(events.get(id).status, "completed");
  const before = subscriptionRows.length;
  assert.equal((await webhook("customer.subscription.updated", currentSubscription, id)).status, 200);
  assert.equal(subscriptionRows.length, before, "Completed duplicate must not update subscriptions");
  cases += 2;
}
assert.equal((await webhook("customer.subscription.deleted", currentSubscription)).status, 200);
assert.equal(subscriptionRows.at(-1).status, "canceled");
const invoice = { parent: { type: "subscription_details", subscription_details: { subscription: "sub_fixture" } } };
assert.equal((await webhook("invoice.paid", invoice)).status, 200);
assert.equal(subscriptionRows.at(-1).status, "active");
assert.equal((await webhook("invoice.payment_failed", invoice)).status, 200);
assert.equal(subscriptionRows.at(-1).status, "active", "Late payment failure must not revoke recovered access");
currentSubscription = { ...currentSubscription, status: "past_due" };
assert.equal((await webhook("invoice.payment_failed", invoice)).status, 200);
assert.equal(subscriptionRows.at(-1).status, "past_due");
currentSubscription = { ...currentSubscription, status: "canceled" };
assert.equal((await webhook("customer.subscription.updated", { ...currentSubscription, status: "active" })).status, 200);
assert.equal(subscriptionRows.at(-1).status, "canceled", "Late active snapshot must not restore canceled access");
currentSubscription = { ...currentSubscription, status: "active" };
const sessionEventId = `evt_fixture_${crypto.randomUUID()}`;
const completedSession = { mode: "subscription", subscription: "sub_fixture",
  customer_details: { email: "fixture@example.invalid" }, metadata: { termsVersion: "fixture" } };
assert.equal((await webhook("checkout.session.completed", completedSession, sessionEventId)).status, 200);
assert.equal(subscriptionRows.at(-1).status, "active");
assert.equal(emailRows.length, 1);
assert.match(emailRows[0].text, /compartidos por Arcabucero y Maestre de Campo/);
assert.equal((await webhook("checkout.session.completed", completedSession, sessionEventId)).status, 200);
assert.equal(emailRows.length, 1, "Completed duplicate must not resend welcome email");
ledgerFailure = true;
assert.equal((await webhook("customer.subscription.updated", currentSubscription)).status, 503);
ledgerFailure = false;
subscriptionFailure = true;
const retryId = `evt_fixture_${crypto.randomUUID()}`;
assert.equal((await webhook("customer.subscription.updated", currentSubscription, retryId)).status, 500);
assert.equal(events.get(retryId).status, "failed");
subscriptionFailure = false;
assert.equal((await webhook("customer.subscription.updated", currentSubscription, retryId)).status, 200);
assert.equal(events.get(retryId).status, "completed");
assert.equal(events.get(retryId).attempts, 2);
cases += 10;
const initialInvoice = { ...invoice, id: "in_fixture", status: "paid", billing_reason: "subscription_create",
  customer_name: "Cliente de prueba", customer_email: "fixture@example.invalid",
  customer_address: { line1: "Calle prueba 12", postal_code: "28001", city: "Madrid", country: "ES" } };
const beforeAdmin = emailRows.length;
assert.equal((await webhook("invoice.paid", { ...initialInvoice, status: "open" })).status, 200);
assert.equal((await webhook("invoice.paid", { ...initialInvoice, billing_reason: "subscription_cycle" })).status, 200);
assert.equal(emailRows.length, beforeAdmin, "Unpaid invoices and renewals must not notify new subscriptions");
adminEmailFailure = true;
const noticeRetry = "evt_fixture_admin_retry";
assert.equal((await webhook("invoice.paid", initialInvoice, noticeRetry)).status, 500);
assert.equal(events.get("admin_subscription_sub_fixture").status, "failed");
adminEmailFailure = false;
assert.equal((await webhook("invoice.paid", initialInvoice, noticeRetry)).status, 200);
assert.equal(emailRows.length, beforeAdmin + 1);
assert.ok(emailRows.at(-1).to.includes("earlrititi@gmail.com"));
assert.match(emailRows.at(-1).text, /Cliente de prueba/);
assert.match(emailRows.at(-1).text, /Calle prueba 12/);
assert.equal((await webhook("invoice.payment_succeeded", initialInvoice)).status, 200);
assert.equal(emailRows.length, beforeAdmin + 1, "Different invoice events must not duplicate the admin notice");
cases += 6;
console.log(`${cases} compiled commerce scenarios passed. No network, real payments or emails.`);
