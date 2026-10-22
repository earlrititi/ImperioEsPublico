import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const env = parseEnv(readFileSync(".env.reservation-test.local", "utf8"));
assert.equal(env.PUBLIC_SUPABASE_URL, "https://joicpkgvggfxzrdazisx.supabase.co");
assert.match(env.STRIPE_SECRET_KEY, /^(sk|rk)_test_/);
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, "false");
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const file = "tmp/commercial-audit/guest-shirt-flow.json";
const stock = async () => {
  const result = await db.from("product_variants").select("sku,physical_stock,reserved_stock,sold_stock,available_stock").order("sku");
  assert.ifError(result.error);
  return result.data;
};
const rpc = async (name, args) => {
  const result = await db.rpc(name, args);
  assert.ifError(result.error);
  return result.data;
};
const save = state => writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });

if (process.argv[2] === "prepare") {
  let previous;
  try { previous = JSON.parse(readFileSync(file, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  assert.ok(!previous || previous.finished, "Clean up the previous guest Test flow first");
  const campaign = await db.from("commerce_campaign").select("purchase_activated,purchase_open_at").eq("id", "shirt-first-edition").single();
  assert.ifError(campaign.error);
  mkdirSync("tmp/commercial-audit", { recursive: true });
  const state = { email: `guest-shirt-${randomUUID()}@example.invalid`, campaign: campaign.data, stock: await stock(), finished: false };
  save(state);
  const enabled = await db.from("commerce_campaign").update({ purchase_activated: true, purchase_open_at: null }).eq("id", "shirt-first-edition");
  assert.ifError(enabled.error);
  console.log(JSON.stringify({ testOnly: true, email: state.email, baseUrl: "http://127.0.0.1:4325", productionChanged: false }));
} else {
  const state = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(state.finished, false);
  assert.match(state.email, /^guest-shirt-[a-f0-9-]+@example\.invalid$/);
  const reservations = await db.from("reservations").select("id,user_id,total_price_snapshot").eq("customer_email", state.email);
  assert.ifError(reservations.error);
  if (process.argv[2] === "verify") assert.equal(reservations.data.length, 1);
  const report = [];
  for (const reservation of reservations.data) {
    assert.equal(reservation.user_id, null, "The browser flow must remain anonymous");
    const attempts = await db.from("reservation_payment_attempts").select("id,status,stripe_session_id").eq("reservation_id", reservation.id);
    assert.ifError(attempts.error);
    if (process.argv[2] === "verify") assert.equal(attempts.data.length, 1);
    for (const attempt of attempts.data) {
      assert.match(attempt.stripe_session_id, /^cs_test_/);
      let session = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
      assert.equal(session.livemode, false);
      assert.equal(session.payment_status, "unpaid");
      assert.equal(session.amount_total, reservation.total_price_snapshot);
      assert.equal(session.amount_total, 2999);
      assert.equal(session.customer, null);
      report.push({ guest: true, totalCents: session.amount_total, testOnly: true, paid: false });
      if (process.argv[2] === "cleanup" && attempt.status === "OPEN") {
        if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id);
        assert.equal(session.status, "expired");
        await rpc("close_shirt_payment", { p_attempt: attempt.id, p_session: session.id, p_expired: true });
      }
    }
    if (process.argv[2] === "cleanup") {
      await rpc("release_shirt_reservation", { p_id: reservation.id, p_status: "CANCELLED" });
      const outbox = await db.from("commerce_outbox").delete().eq("reservation_id", reservation.id).eq("status", "PENDING");
      assert.ifError(outbox.error);
    }
  }
  if (process.argv[2] === "cleanup") {
    const restored = await db.from("commerce_campaign").update(state.campaign).eq("id", "shirt-first-edition");
    assert.ifError(restored.error);
    assert.deepEqual(await stock(), state.stock);
    state.finished = true;
    save(state);
  } else assert.equal(process.argv[2], "verify");
  console.log(JSON.stringify({ report, testCampaignAndStockRestored: state.finished, productionChanged: false }));
}
