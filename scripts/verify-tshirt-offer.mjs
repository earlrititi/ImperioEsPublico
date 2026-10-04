import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { Socket } from "node:net";
import Stripe from "../.vercel/output/functions/_render.func/node_modules/stripe/esm/stripe.esm.node.js";

Socket.prototype.connect = () => { throw new Error("Network disabled in offer fixtures"); };
Object.assign(process.env, {
  STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_PRICE_CAMISETA_IMPERIAL: "price_shirt_fixture",
  PUBLIC_SITE_URL: "https://imperioes.com", PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fixture", RESEND_API_KEY: "re_fixture", COMMERCE_EMAIL_MODE: "live",
  RATE_LIMIT_SECRET: "fixture",
});
const email = "reader@example.invalid";
let subscription = null;
let stripeStatus = "active";
let lead = null;
let failAdmin = false;
let couponCreates = 0;
let promotionCreates = 0;
let coupon = null;
const requests = [];
const receipts = new Map();
const events = new Map();
const promotion = { id: "promo_fixture", code: "FIXTURE15", active: true, max_redemptions: 1, times_redeemed: 0 };

Stripe.StripeResource.prototype._makeRequest = async (method, path, params) => {
  if (path === "/v1/subscriptions/sub_fixture") return { id: "sub_fixture", status: stripeStatus };
  if (path === "/v1/prices/price_shirt_fixture") return { id: "price_shirt_fixture", product: "prod_shirt_fixture" };
  if (method === "GET" && path.startsWith("/v1/coupons/")) {
    if (coupon) return coupon;
    throw Object.assign(new Error("fixture missing coupon"), { code: "resource_missing" });
  }
  if (method === "POST" && path === "/v1/coupons") {
    couponCreates++;
    assert.deepEqual(params.applies_to, { products: ["prod_shirt_fixture"] });
    assert.equal(params.percent_off, 15);
    return coupon = { ...params, valid: true };
  }
  if (method === "POST" && path === "/v1/promotion_codes") {
    promotionCreates++;
    assert.equal(params.max_redemptions, 1);
    assert.equal(params.restrictions, undefined, "Existing Stripe customers must remain eligible");
    return promotion;
  }
  if (method === "GET" && path === "/v1/promotion_codes/promo_fixture") return promotion;
  throw new Error(`Unexpected fixture Stripe request: ${method} ${path}`);
};
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  const url = new URL(req.url);
  const body = req.method === "GET" ? null : await req.json();
  if (url.pathname === "/rest/v1/subscriptions") return Response.json(subscription);
  if (url.pathname === "/rest/v1/marketing_leads") {
    if (req.method === "POST") {
      assert.equal(body.marketing_accepted_at, null);
      assert.equal(body.marketing_version, null);
      lead ||= { id: "lead_fixture", ...body, redeemed_at: null, email_sent_at: null };
      return new Response(null, { status: 201 });
    }
    if (req.method === "PATCH") Object.assign(lead, body);
    return Response.json(lead);
  }
  if (url.pathname === "/rest/v1/stripe_webhook_events") {
    const id = body?.event_id ?? url.searchParams.get("event_id")?.replace(/^eq\./, "");
    if (req.method === "POST") {
      if (events.has(id)) return Response.json({ code: "23505" }, { status: 409 });
      events.set(id, { ...body, attempts: 1, received_at: new Date().toISOString() });
      return new Response(null, { status: 201 });
    }
    if (req.method === "PATCH") {
      Object.assign(events.get(id), body);
      return req.headers.get("prefer")?.includes("return=representation")
        ? Response.json({ event_id: id }) : new Response(null, { status: 204 });
    }
    return Response.json(events.get(id));
  }
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit") return Response.json(true);
  if (url.pathname === "/rest/v1/legal_consents") return new Response(null, { status: 201 });
  if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
    const key = req.headers.get("idempotency-key");
    requests.push({ body, key });
    if (failAdmin && body.to.includes("earlrititi@gmail.com"))
      return Response.json({ name: "application_error", message: "fixture failure" }, { status: 500 });
    receipts.set(key, { body, key });
    return Response.json({ id: `email_${receipts.size}` });
  }
  throw new Error(`Unexpected fixture request: ${req.method} ${url.pathname}`);
};

const chunks = new URL("../.vercel/output/functions/_render.func/dist/server/chunks/", import.meta.url);
async function exportedFunction(prefix, name) {
  const file = readdirSync(chunks).find(file => file.startsWith(prefix) && file.endsWith(".mjs"));
  assert.ok(file, prefix);
  const module = await import(new URL(file, chunks));
  const fn = Object.values(module).find(value => typeof value === "function" && value.name === name);
  assert.ok(fn, name);
  return fn;
}
const findPromotion = await exportedFunction("tshirt-promotion_", "findActiveTshirtPromotion");
const sendDiscount = await exportedFunction("tshirt-promotion_", "sendArcabuceroDiscount");
const notify = await exportedFunction("lead-notifications_", "notifyLead");

assert.equal(await findPromotion(email), null);
for (const status of ["past_due", "trialing", "canceled"]) {
  subscription = { plan: "arcabucero", status, stripe_subscription_id: "sub_fixture" };
  assert.equal(await findPromotion(email), null);
}
subscription = { plan: "maestre_campo", status: "active", stripe_subscription_id: "sub_fixture" };
assert.equal(await findPromotion(email), null);
assert.equal(couponCreates, 0);
subscription = { plan: "arcabucero", status: "active", stripe_subscription_id: "sub_fixture" };
stripeStatus = "canceled";
assert.equal(await findPromotion(email), null, "A stale local record cannot grant an offer");
stripeStatus = "active";
assert.deepEqual(await findPromotion(email), { leadId: "lead_fixture", promotionCodeId: "promo_fixture" });
assert.equal(couponCreates, 1);
assert.equal(promotionCreates, 1);
await sendDiscount(email, "Reader Fixture");
await sendDiscount(email, "Reader Fixture");
assert.equal(requests.length, 1, "Repeated invoice events must not resend the discount");
assert.match(requests[0].body.text, /suscripción activa/);
assert.equal(promotionCreates, 1);
lead.redeemed_at = new Date().toISOString();
assert.equal(await findPromotion(email), null, "A redeemed benefit is never recreated");

failAdmin = true;
const notice = { kind: "registration", reference: "user_fixture", email };
await assert.rejects(notify(notice));
failAdmin = false;
await notify(notice);
const afterRetry = requests.length;
await notify(notice);
assert.equal(requests.length, afterRetry, "Durable completed notice must not be resent");
assert.deepEqual(requests.at(-1), requests.at(-2), "Failed send retries with the same recipient, body and key");
process.env.COMMERCE_EMAIL_MODE = "test";
process.env.COMMERCE_TEST_EMAIL = "sink@example.invalid";
await notify({ kind: "subscription_interest", reference: "cs_fixture", email, plan: "ARCABUCERO mensual" });
assert.equal(requests.at(-1).body.to, "sink@example.invalid");
process.env.COMMERCE_EMAIL_MODE = "live";

const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const requestId = crypto.randomUUID();
const manifesto = () => app.fetch(new Request("https://imperioes.com/api/manifesto.php", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: "https://imperioes.com" },
  body: JSON.stringify({ firstName: "Reader", lastName: "Fixture", email, anonymousId: requestId,
    requestId, privacyAcknowledged: true, source: "home" }),
}));
failAdmin = true;
assert.equal((await manifesto()).status, 500);
failAdmin = false;
assert.equal((await manifesto()).status, 200);
assert.equal((await manifesto()).status, 200);
const customerReceipts = [...receipts.values()].filter(receipt => receipt.key === `manifesto-${requestId}`);
assert.equal(customerReceipts.length, 1);
assert.equal(customerReceipts[0].body.attachments.length, 1);
const ownerReceipts = [...receipts.values()].filter(receipt => /Solicitud del manifiesto/.test(receipt.body.subject));
assert.equal(ownerReceipts.length, 1);
assert.equal(ownerReceipts[0].body.to, "earlrititi@gmail.com");
console.log("Offer and lead mail fixtures passed: paid eligibility, stale/canceled/redeemed denial, product restriction, existing customer eligibility, consent separation, durable owner retries, test isolation and manifesto attachment. No real emails or payments.");
