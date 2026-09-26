import assert from "node:assert/strict";
import { Socket } from "node:net";
import { createHash } from "node:crypto";
import Stripe from "../.vercel/output/functions/_render.func/node_modules/stripe/esm/stripe.esm.node.js";
Socket.prototype.connect = () => {
  throw new Error("No real network allowed in reservation Checkout fixtures");
};
Object.assign(process.env, {
  RESERVATION_MODE: "true",
  SHIRT_SALES_APPROVED: "true",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_CAMISETA_IMPERIAL: "price_shirt_fixture",
  STRIPE_ES_VAT_RATE_ID: "txr_fixture",
  STRIPE_LIVE_CHECKOUT_ENABLED: "false",
  COMMERCE_EMAIL_MODE: "disabled",
  PUBLIC_SITE_URL: "https://imperioes.com",
  RATE_LIMIT_SECRET: "fixture",
  RESERVATION_TOKEN_SECRET: "fixture",
  PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
});
const id = "11111111-1111-4111-8111-111111111111",
  attemptId = "22222222-2222-4222-8222-222222222222",
  token = "c".repeat(64);
const address = {
  name: "Test Fixture",
  line1: "Calle Pruebas 12",
  line2: "",
  postalCode: "28001",
  city: "Madrid",
  province: "28",
  country: "ES",
};
const reservation = {
  id,
  user_id: null,
  request_id: id,
  token_hash: createHash("sha256").update(token).digest("hex"),
  status: "PURCHASE_AVAILABLE",
  customer_email: "test@example.invalid",
  customer_name: "Cliente Fixture",
  number: "RES-FIXTURE",
  total_quantity: 3,
  total_price_snapshot: 8997,
  reservation_items: [
    { sku: "IE-CAMISETA-IMPERIAL-M", quantity: 2, unit_price_snapshot: 2999 },
    { sku: "IE-CAMISETA-IMPERIAL-XL", quantity: 1, unit_price_snapshot: 2999 },
  ],
};
const attempt = {
  id: attemptId,
  reservation_id: id,
  stripe_session_id: null,
  shipping_address: address,
  expires_at: new Date(Date.now() + 3600000).toISOString(),
};
let priceAmount = 2999,
  creates = 0,
  completionCalls = 0,
  checkoutParams,
  closedCalls = 0,
  expiredSessions = 0;
let session = {
  id: "cs_test_reservation_fixture",
  status: "open",
  payment_status: "unpaid",
  mode: "payment",
  currency: "eur",
  amount_total: 8997,
  total_details: { amount_shipping: 0, amount_tax: 1561, amount_discount: 0 },
  url: "https://checkout.stripe.com/test_fixture",
  metadata: { reservationAttemptId: attemptId },
  payment_intent: "pi_test_reservation_fixture",
};
Stripe.StripeResource.prototype._makeRequest = async (
  method,
  path,
  params,
  options,
) => {
  if (method === "GET" && path.startsWith("/v1/prices/"))
    return {
      id: "price_shirt_fixture",
      type: "one_time",
      active: true,
      currency: "eur",
      unit_amount: priceAmount,
      livemode: false,
      tax_behavior: "inclusive",
    };
  if (method === "GET" && path === "/v1/tax_rates/txr_fixture")
    return {
      id: "txr_fixture",
      active: true,
      inclusive: true,
      percentage: 21,
      country: "ES",
      livemode: false,
    };
  if (method === "POST" && path === "/v1/checkout/sessions") {
    assert.equal(options.idempotencyKey, `reservation-payment-${attemptId}`);
    creates++;
    checkoutParams = params;
    return session;
  }
  if (method === "GET" && path === `/v1/checkout/sessions/${session.id}`)
    return session;
  if (
    method === "POST" &&
    path === `/v1/checkout/sessions/${session.id}/expire`
  ) {
    expiredSessions++;
    session = { ...session, status: "expired" };
    return session;
  }
  throw new Error(`Unexpected Stripe request: ${method} ${path}`);
};
const json = (data, status = 200) => Response.json(data, { status });
const events = new Map();
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init),
    url = new URL(request.url);
  const body = request.method === "GET" ? null : await request.json();
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit") return json(true);
  if (url.pathname === "/rest/v1/reservations") return json(reservation);
  if (url.pathname === "/rest/v1/marketing_leads") return json(null);
  if (url.pathname === "/rest/v1/rpc/begin_shirt_payment")
    return json(attemptId);
  if (url.pathname === "/rest/v1/reservation_payment_attempts") {
    if (request.method === "PATCH") {
      Object.assign(attempt, body);
      return new Response(null, { status: 204 });
    }
    return json(attempt);
  }
  if (url.pathname === "/rest/v1/rpc/complete_shirt_payment") {
    assert.equal(body.p_total, 8997);
    assert.equal(body.p_shipping, 0);
    assert.equal(body.p_attempt, attemptId);
    completionCalls++;
    return json("33333333-3333-4333-8333-333333333333");
  }
  if (url.pathname === "/rest/v1/rpc/close_shirt_payment") {
    closedCalls++;
    return json(null);
  }
  if (url.pathname === "/rest/v1/stripe_webhook_events") {
    const eventId =
      body?.event_id ?? url.searchParams.get("event_id")?.replace(/^eq\./, "");
    if (request.method === "POST") {
      if (events.has(eventId)) return json({ code: "23505" }, 409);
      events.set(eventId, {
        ...body,
        attempts: 1,
        received_at: new Date().toISOString(),
      });
      return new Response(null, { status: 201 });
    }
    if (request.method === "GET") return json(events.get(eventId));
    if (request.method === "PATCH") {
      Object.assign(events.get(eventId), body);
      return request.headers.get("prefer")?.includes("return=representation")
        ? json({ event_id: eventId })
        : new Response(null, { status: 204 });
    }
  }
  throw new Error(
    `Unexpected fixture request ${request.method} ${url.pathname}`,
  );
};
const { default: app } =
  await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
let checks = 0;
const checkout = (extra = {}) =>
  app.fetch(
    new Request(`https://imperioes.com/api/reservations/${id}/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://imperioes.com",
      },
      body: JSON.stringify({ token, address, confirmPurchase: true, ...extra }),
    }),
  );
assert.equal((await checkout()).status, 409);
assert.equal(creates, 0);
checks++;
process.env.RESERVATION_MODE = "false";
assert.equal(
  (await checkout({ total: 1, price: 1, shippingCost: 100 })).status,
  200,
);
assert.equal(creates, 1);
checks++;
assert.equal(checkoutParams.mode, "payment");
assert.equal(checkoutParams.automatic_tax.enabled, false);
assert.equal(checkoutParams.customer_creation, "if_required");
assert.equal(checkoutParams.adaptive_pricing.enabled, false);
assert.deepEqual(checkoutParams.line_items, [
  { price: "price_shirt_fixture", quantity: 2, tax_rates: ["txr_fixture"] },
  { price: "price_shirt_fixture", quantity: 1, tax_rates: ["txr_fixture"] },
]);
for (const key of [
  "shipping_options",
  "shipping_address_collection",
  "customer",
  "setup_future_usage",
  "tax_id_collection",
  "phone_number_collection",
])
  assert.equal(checkoutParams[key], undefined);
checks++;
assert.equal((await checkout()).status, 200);
assert.equal(creates, 1);
checks++;
assert.notEqual((await checkout({ confirmPurchase: false })).status, 200);
checks++;
assert.notEqual(
  (
    await checkout({
      address: { ...address, postalCode: "07001", province: "07" },
    })
  ).status,
  200,
);
checks++;
priceAmount = 2699;
assert.notEqual((await checkout()).status, 200);
assert.equal(creates, 1);
priceAmount = 2999;
checks++;
async function webhook(type, eventId, object) {
  const body = JSON.stringify({
    id: eventId,
    object: "event",
    type,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  return app.fetch(
    new Request("https://imperioes.com/api/stripe-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": Stripe.webhooks.generateTestHeaderString({
          payload: body,
          secret: "whsec_fixture",
        }),
      },
      body,
    }),
  );
}
session = { ...session, status: "complete", payment_status: "paid" };
assert.equal(
  (await webhook("checkout.session.completed", "evt_reservation_paid", session))
    .status,
  200,
);
assert.equal(completionCalls, 1);
checks++;
assert.equal(
  (await webhook("checkout.session.completed", "evt_reservation_paid", session))
    .status,
  200,
);
assert.equal(completionCalls, 1);
checks++;
session = { ...session, status: "expired", payment_status: "unpaid" };
assert.equal(
  (
    await webhook(
      "checkout.session.expired",
      "evt_reservation_expired",
      session,
    )
  ).status,
  200,
);
assert.equal(closedCalls, 1);
checks++;
session = { ...session, status: "open" };
assert.equal(
  (
    await webhook("payment_intent.payment_failed", "evt_reservation_failed", {
      id: "pi_test_reservation_fixture",
      metadata: { reservationAttemptId: attemptId },
    })
  ).status,
  200,
);
assert.equal(closedCalls, 2);
checks++;
const resetPayment = (accessToken = token) =>
  app.fetch(
    new Request(`https://imperioes.com/api/reservations/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://imperioes.com",
      },
      body: JSON.stringify({ action: "reset-payment", token: accessToken }),
    }),
  );
assert.equal((await resetPayment()).status, 200);
assert.equal(expiredSessions, 1);
assert.equal(closedCalls, 3);
checks++;
session = { ...session, status: "complete", payment_status: "paid" };
assert.equal((await resetPayment()).status, 409);
assert.equal(closedCalls, 3);
checks++;
attempt.stripe_session_id = null;
assert.equal((await resetPayment()).status, 409);
assert.equal(expiredSessions, 1);
checks++;
assert.equal((await resetPayment("d".repeat(64))).status, 404);
checks++;
assert.equal((await webhook("checkout.session.async_payment_succeeded", "evt_async_paid", session)).status, 200);
assert.equal(completionCalls, 2);
checks++;
session = { ...session, status: "open", payment_status: "unpaid" };
assert.equal((await webhook("checkout.session.completed", "evt_unpaid_completed", session)).status, 200);
assert.equal(completionCalls, 2);
checks++;
assert.equal((await webhook("checkout.session.async_payment_failed", "evt_async_failed", session)).status, 200);
assert.equal(completionCalls, 2);
checks++;
const invalidSignature = await app.fetch(new Request("https://imperioes.com/api/stripe-webhook", {
  method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "invalid" }, body: "{}",
}));
assert.equal(invalidSignature.status, 400);
checks++;
console.log(
  `${checks} compiled reservation Checkout/webhook scenarios passed. Stripe and database transports simulated; no payments or outbound network.`,
);
