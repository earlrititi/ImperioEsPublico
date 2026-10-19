import assert from "node:assert/strict";
import { Socket } from "node:net";
import { readdirSync, readFileSync } from "node:fs";
import Stripe from "../.vercel/output/functions/_render.func/node_modules/stripe/esm/stripe.esm.node.js";

// No provider writes, payments, emails or network are possible in this suite.
Socket.prototype.connect = () => { throw new Error("Network disabled in subscription analytics fixtures"); };
Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_fixture", PUBLIC_SITE_URL: "https://imperioes.com",
  PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", PUBLIC_SUPABASE_ANON_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service", RATE_LIMIT_SECRET: "fixture-rate" });
const plans = [
  ["arcabucero-monthly", "arcabucero", "month", 199, "STRIPE_PRICE_ARCABUCERO_MONTHLY"],
  ["arcabucero-annual", "arcabucero", "year", 1799, "STRIPE_PRICE_ARCABUCERO_ANNUAL"],
  ["maestre-campo-monthly", "maestre_campo", "month", 399, "STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY"],
  ["maestre-campo-annual", "maestre_campo", "year", 3799, "STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL"],
];
for (const [slug, , , , key] of plans) process.env[key] = `price_${slug}`;
let selected = plans[3], mode = "paid", allowed = true, reads = 0;
Stripe.StripeResource.prototype._makeRequest = async (method, path) => {
  assert.equal(method, "GET", "analytics cannot mutate Stripe"); reads++;
  const [slug, plan, interval, total] = selected;
  const tax = total - Math.round(total / 1.21), now = Math.floor(Date.now() / 1000);
  const invoice = { id: "in_fixture", livemode: true, customer: "cus_fixture", customer_email: "private@example.invalid",
    customer_name: "Private name", customer_address: { line1: "Private address" }, status: "paid", currency: "eur",
    billing_reason: mode === "renewal" ? "subscription_cycle" : "subscription_create",
    parent: { subscription_details: { subscription: "sub_fixture" } }, status_transitions: { paid_at: now },
    total, amount_paid: total, amount_remaining: 0, total_excluding_tax: total - tax, total_taxes: [{ amount: tax }],
    starting_balance: 0, ending_balance: 0, pre_payment_credit_notes_amount: 0, post_payment_credit_notes_amount: 0,
    lines: { has_more: false, data: [{ amount: total, quantity: 1, pricing: { price_details: { price: `price_${slug}` } } }] } };
  if (path === "/v1/checkout/sessions/cs_live_fixture") {
    if (mode === "missing") throw Object.assign(new Error("Private provider detail"), { code: "resource_missing" });
    if (mode === "failure") throw new Error("Private provider detail");
    return { id: "cs_live_fixture", livemode: mode !== "test", mode: "subscription", status: "complete",
      payment_status: mode === "unpaid" ? "unpaid" : "paid", currency: "eur", amount_total: total,
      created: now - (mode === "old" ? 25 * 3600 : 0), customer: "cus_fixture", invoice,
      subscription: { id: "sub_fixture", livemode: true, status: "active", customer: "cus_fixture", metadata: { plan, billingInterval: interval } } };
  }
  if (path === `/v1/prices/price_${slug}`) return { id: `price_${slug}`, active: true, livemode: true, type: "recurring",
    currency: "eur", unit_amount: mode === "wrong_price" ? 1 : total, recurring: { interval, interval_count: 1 } };
  if (path === "/v1/invoice_payments") return { has_more: mode === "multiple", data: [{ livemode: true, status: "paid",
    invoice: "in_fixture", amount_paid: total, currency: "eur", payment: { type: "payment_intent", payment_intent: "pi_fixture" } }] };
  if (path === "/v1/payment_intents/pi_fixture") return { id: "pi_fixture", livemode: true, status: "succeeded",
    amount_received: total, currency: "eur", customer: "cus_fixture", latest_charge: { id: "ch_fixture", livemode: true,
      status: "succeeded", paid: true, captured: true, customer: "cus_fixture", payment_intent: "pi_fixture",
      currency: "eur", amount: total, refunded: mode === "refunded", amount_refunded: mode === "refunded" ? total : 0,
      disputed: mode === "disputed" } };
  throw new Error(`Unexpected Stripe fixture path: ${path}`);
};
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit") return Response.json(allowed);
  throw new Error(`Unexpected external fixture path: ${url.pathname}`);
};
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const call = (body = JSON.stringify({ sessionId: "cs_live_fixture" }), extra = {}, origin = "https://imperioes.com") =>
  app.fetch(new Request("https://imperioes.com/api/subscriptions/purchase", { method: "POST",
    headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": "application/json", ...extra }, body }));
for (const origin of ["https://untrusted.example", ""]) assert.equal((await call(undefined, {}, origin)).status, 403);
assert.equal((await call(undefined, { "Content-Type": "text/plain" })).status, 415);
assert.equal((await call(" ".repeat(1025))).status, 413);
for (const body of ["{", "{}", '{"sessionId":"cs_test_fixture"}', '{"sessionId":"private@example.invalid"}']) {
  const response = await call(body); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { analyticsPurchase: null });
}
assert.equal(reads, 0, "invalid or Test capabilities must not reach Stripe");
allowed = false; assert.equal((await call()).status, 429); assert.equal(reads, 0); allowed = true;
for (selected of plans) {
  const response = await call(); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const result = await response.json(), receipt = result.analyticsPurchase;
  assert.ok(receipt); assert.match(receipt.transaction_id, /^ie_[a-f0-9]{64}$/);
  assert.equal(receipt.items[0].item_variant, selected[0]);
  assert.equal(Math.round((receipt.value + receipt.tax) * 100), selected[3]);
  assert.doesNotMatch(JSON.stringify(result), /Private|private@example|cs_live|cus_fixture|sub_fixture|pi_fixture|in_fixture/);
  assert.deepEqual(await (await call()).json(), result);
}
for (mode of ["test", "unpaid", "old", "renewal", "refunded", "disputed", "wrong_price", "multiple", "missing"]) {
  const response = await call(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { analyticsPurchase: null });
}
mode = "failure";
const failed = await call(); assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /Private provider/);
const page = await app.fetch(new Request("https://imperioes.com/gracias?session_id=cs_live_fixture"));
assert.equal(page.status, 200); assert.equal(page.headers.get("cache-control"), "private, no-store");
const html = await page.text(); assert.match(html, /Estamos comprobando tu acceso/); assert.doesNotMatch(html, /Acceso premium activado/);
for (const file of readdirSync(".vercel/output/static/_astro").filter(file => file.endsWith(".js"))) {
  const source = readFileSync(`.vercel/output/static/_astro/${file}`, "utf8");
  assert.doesNotMatch(source, /subscription-invoice:|subscription_purchase_receipt|STRIPE_SECRET_KEY/);
}
for (const path of ["privacidad", "cookies"]) {
  const response = await app.fetch(new Request(`https://imperioes.com/legal/${path}`));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /REQUIERE VERIFICACION|debe definirse|antes de publicar esta revision/);
  assert.match(text, path === "privacidad" ? /primer pago de la suscripcion/ : /retorno limpio de una compra confirmada/);
}
console.log("Subscription analytics: 4 plans, 9 excluded payment states, CSRF, size limit, rate limit, privacy, stable receipts and failure isolation passed. No real network.");
