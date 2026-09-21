import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const env = parseEnv(readFileSync(".env.reservation-test.local", "utf8"));
assert.equal(
  env.PUBLIC_SUPABASE_URL,
  "https://joicpkgvggfxzrdazisx.supabase.co",
);
assert.equal(env.RESERVATION_MODE, "true");
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, "false");
assert.match(env.STRIPE_SECRET_KEY, /^(sk|rk)_test_/);
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (
    url.hostname.endsWith(".supabase.co") &&
    url.origin !== env.PUBLIC_SUPABASE_URL
  )
    throw new Error(
      "Test artifact points outside the isolated Supabase project; rebuild with --mode reservation-test",
    );
  return originalFetch(input, init);
};
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, "acct_1UCc4cDRITvLIOKF");
const db = createClient(
  env.PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
// Enable purchases only in this process, never in the saved or running web environment.
Object.assign(process.env, env, {
  SHIRT_SALES_APPROVED: "true",
  COMMERCE_EMAIL_MODE: "disabled",
});
const { default: app } =
  await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const origin = env.PUBLIC_SITE_URL.replace(/\/$/, "");
const address = {
  name: "Cliente Stripe API Test",
  line1: "Calle Pruebas 12",
  line2: "",
  city: "Madrid",
  postalCode: "28001",
  province: "28",
  country: "ES",
};
const rpc = async (name, body) => {
  const { data, error } = await db.rpc(name, body);
  if (error) throw new Error(`Test RPC failed: ${name}`);
  return data;
};
const stock = async () => {
  const { data, error } = await db
    .from("product_variants")
    .select("sku,physical_stock,reserved_stock,sold_stock,available_stock")
    .order("sku");
  if (error) throw new Error("Stock lookup failed");
  return data;
};
const before = await stock();
const results = [];
try {
  for (const quantity of [1, 2, 3, 5]) {
    const requestId = randomUUID(),
      token = randomBytes(32).toString("hex");
    const items =
      quantity === 3
        ? [
            { sku: "IE-CAMISETA-IMPERIAL-M", quantity: 2 },
            { sku: "IE-CAMISETA-IMPERIAL-XL", quantity: 1 },
          ]
        : [{ sku: "IE-CAMISETA-IMPERIAL-M", quantity }];
    const id = await rpc("create_shirt_reservation", {
      p_request_id: requestId,
      p_payload_hash: createHash("sha256")
        .update(JSON.stringify(items))
        .digest("hex"),
      p_token_hash: createHash("sha256").update(token).digest("hex"),
      p_user_id: null,
      p_customer: {
        name: address.name,
        email: "stripe-api-test@example.invalid",
        phone: "+34 600000000",
      },
      p_address: address,
      p_items: items,
      p_terms: "2026-09-10",
      p_privacy: "2026-09-10",
      p_expires_hours: 0,
    });
    let sessionId;
    const checkout = () =>
      app.fetch(
        new Request(`${origin}/api/reservations/${id}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify({
            token,
            address,
            confirmPurchase: true,
            total: 1,
            shippingCost: 999,
          }),
        }),
      );
    try {
      process.env.RESERVATION_MODE = "true";
      assert.equal((await checkout()).status, 409);
      await rpc("open_shirt_purchase", { p_id: id });
      process.env.RESERVATION_MODE = "false";
      const response = await checkout();
      assert.equal(
        response.status,
        200,
        `Checkout API rejected ${quantity} units`,
      );
      const { data: attempt, error } = await db
        .from("reservation_payment_attempts")
        .select("id,stripe_session_id")
        .eq("reservation_id", id)
        .eq("status", "OPEN")
        .single();
      assert.ifError(error);
      sessionId = attempt.stripe_session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      assert.equal(session.livemode, false);
      assert.equal(session.currency, "eur");
      assert.equal(session.amount_total, quantity * 2999);
      assert.equal(session.total_details.amount_shipping, 0);
      assert.equal(session.total_details.amount_discount, 0);
      assert.ok(session.total_details.amount_tax > 0);
      assert.equal(session.payment_status, "unpaid");
      assert.equal(session.automatic_tax.enabled, false);
      assert.equal(session.customer, null);
      const lines = await stripe.checkout.sessions.listLineItems(sessionId);
      assert.equal(
        lines.data.reduce((sum, line) => sum + line.quantity, 0),
        quantity,
      );
      assert.ok(
        lines.data.every(
          (line) =>
            line.price.unit_amount === 2999 &&
            line.price.tax_behavior === "inclusive",
        ),
      );
      assert.equal((await checkout()).status, 200);
      const attempts = await db
        .from("reservation_payment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("reservation_id", id);
      assert.ifError(attempts.error);
      assert.equal(attempts.count, 1);
      results.push({
        quantity,
        totalCents: session.amount_total,
        shippingCents: 0,
        vatIncluded: true,
        paid: false,
      });
    } finally {
      // Expire any recoverable Checkout before releasing its reserved inventory.
      const { data: attempts, error } = await db
        .from("reservation_payment_attempts")
        .select("id,stripe_session_id")
        .eq("reservation_id", id)
        .eq("status", "OPEN");
      assert.ifError(error);
      for (const attempt of attempts ?? []) {
        const sid = attempt.stripe_session_id ?? sessionId;
        if (!sid)
          throw new Error(
            "Attempt requires Stripe reconciliation before releasing inventory",
          );
        let session = await stripe.checkout.sessions.retrieve(sid);
        if (session.status === "open")
          session = await stripe.checkout.sessions.expire(sid);
        assert.equal(session.status, "expired");
        await rpc("close_shirt_payment", {
          p_attempt: attempt.id,
          p_session: sid,
          p_expired: true,
        });
      }
      await rpc("release_shirt_reservation", {
        p_id: id,
        p_status: "CANCELLED",
      });
      // Synthetic API tests must not enqueue mail to real customers.
      const deleted = await db
        .from("commerce_outbox")
        .delete()
        .eq("reservation_id", id)
        .eq("status", "PENDING");
      assert.ifError(deleted.error);
      process.env.RESERVATION_MODE = "true";
    }
  }
  assert.deepEqual(await stock(), before);
  console.log(
    JSON.stringify({
      account: "acct_1UCc4cDRITvLIOKF",
      mode: "test",
      realStripeSessions: results,
      stockRestored: true,
      savedReservationModeUnchanged: true,
      paymentAndWebhookNotTested: true,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      verified: false,
      code: error.code ?? error.name,
      message:
        error instanceof assert.AssertionError
          ? error.message
          : "Stripe API test failed; inspect configuration without logging credentials",
      productionChanged: false,
    }),
  );
  process.exitCode = 1;
}
