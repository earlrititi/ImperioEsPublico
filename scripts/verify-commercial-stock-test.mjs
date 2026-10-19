import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const env = parseEnv(readFileSync(".env.reservation-test.local", "utf8"));
assert.equal(env.PUBLIC_SUPABASE_URL, "https://joicpkgvggfxzrdazisx.supabase.co");
assert.ok(/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? ""));
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, "false");
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const anon = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const digest = text => createHash("sha256").update(text).digest("hex");
const result = await db.from("product_variants").select("sku,available_stock").eq("active",true).gt("available_stock",0).order("sku").limit(1).single();
assert.ifError(result.error);
const original = result.data;
const allocated = [];
const make = () => ({ p_request_id:randomUUID(),p_payload_hash:digest(randomUUID()),p_token_hash:digest(randomBytes(32).toString("hex")),p_user_id:null,
  p_customer:{name:"Prueba concurrente sin envio",email:"stock-test@example.invalid"},
  p_address:{name:"Prueba concurrente",line1:"Calle Test 1",postalCode:"28001",city:"Madrid",province:"28",country:"ES"},
  p_items:[{sku:original.sku,quantity:original.available_stock}],p_terms:"2026-10-16",p_privacy:"2026-10-16",p_expires_hours:0 });
const parameters = [make(),make()];
try {
  const results = await Promise.all(parameters.map(args => db.rpc("create_shirt_reservation",args)));
  results.forEach((outcome,index) => {if (!outcome.error && typeof outcome.data === "string") allocated.push({id:outcome.data,index});});
  assert.equal(allocated.length,1,"Concurrent reservations must not oversell the same Test stock");
  assert.ok(results.find(outcome=>outcome.error)?.error.message.includes("OUT_OF_STOCK"));
  const retry = await db.rpc("create_shirt_reservation",parameters[allocated[0].index]);
  assert.ifError(retry.error); assert.equal(retry.data,allocated[0].id);
  const held = await db.from("product_variants").select("physical_stock,reserved_stock,sold_stock,available_stock").eq("sku",original.sku).single();
  assert.ifError(held.error); assert.equal(held.data.available_stock,0);
  assert.equal(held.data.physical_stock-held.data.reserved_stock-held.data.sold_stock,0);
  const hidden = await anon.from("reservations").select("id").eq("id",allocated[0].id);
  assert.ok(hidden.error || !hidden.data?.length);
  const forbidden = await anon.rpc("release_shirt_reservation",{p_id:allocated[0].id,p_status:"CANCELLED"});
  assert.ok(forbidden.error,"Anonymous clients must not release inventory");
} finally {
  for (const row of allocated) {
    const released = await db.rpc("release_shirt_reservation",{p_id:row.id,p_status:"CANCELLED"});
    assert.ifError(released.error);
    // These are this script's synthetic unsent jobs, never historical customer mail.
    const removed = await db.from("commerce_outbox").delete().eq("reservation_id",row.id).eq("status","PENDING");
    assert.ifError(removed.error);
  }
}
const restored = await db.from("product_variants").select("available_stock").eq("sku",original.sku).single();
assert.ifError(restored.error); assert.equal(restored.data.available_stock,original.available_stock);
console.log("Real Supabase Test: concurrent stock exclusion, request idempotency, anonymous RLS/RPC denial and complete stock release passed. No Stripe calls, emails or production mutations.");
