import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, 'false');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const base = 'http://127.0.0.1:4325', created = [], run = randomUUID();
let checks = 0;
const call = async (path, body) => {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', Origin: base } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
};
const body = async (quantity = 1, extra = {}) => {
  const { data: proof } = await call('/api/reservations/challenge');
  let nonce = 0;
  while (!createHash('sha256').update(`${proof.challenge}:${nonce}`).digest('hex').startsWith('000')) nonce++;
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return { requestId: proof.challenge.split('.')[0], challenge: proof.challenge, nonce: String(nonce),
    customer: { name: 'Prueba pre-reserva', email: `${run}@example.invalid` },
    accepted: true, website: '', items: [{ sku: 'IE-CAMISETA-IMPERIAL-S', quantity }], ...extra };
};
const keep = (result) => {
  if (result.status === 201) { const [id, token] = new URL(result.data.url).hash.slice(1).split('.'); const own = { id, token }; created.push(own); return own; }
};
try {
  const initial = await call('/api/reservations/inventory');
  assert.equal(initial.data.reservationMode, true); assert.equal(initial.data.campaign.max_reservation_quantity, 2); checks++;
  const available = initial.data.variants.find((v) => v.name === 'S').available_stock;
  assert.ok(available >= 1 && available <= 3, 'Run requires the expected isolated S inventory');
  if (available > 1) { const held = await call('/api/reservations', await body(available - 1)); keep(held); assert.equal(held.status, 201); }
  const a = await body(), b = await body();
  const pair = await Promise.all([call('/api/reservations', a), call('/api/reservations', b)]);
  for (const result of pair) keep(result);
  assert.deepEqual(pair.map((r) => r.status).sort(), [201, 409]);
  assert.equal(pair.find((r) => r.status === 409).data.code, 'OUT_OF_STOCK'); checks++;
  const own = created.at(-1);
  const viewed = await call(`/api/reservations/${own.id}`, { action: 'view', token: own.token });
  assert.equal(viewed.data.reservation.customer_phone, null); assert.equal(viewed.data.reservation.shipping_address, null);
  assert.equal(viewed.data.reservation.marketing_consent, false); assert.equal(viewed.data.reservation.total_price_snapshot, 2999); checks++;
  assert.equal((await call(`/api/reservations/${own.id}`, { action: 'view', token: 'a'.repeat(64) })).status, 404); checks++;
  assert.equal((await call(`/api/reservations/${own.id}/checkout`, { token: own.token })).data.code, 'RESERVATION_MODE'); checks++;
  const wait = await call('/api/reservations', await body(1, { waitlist: true, marketing: true }));
  const waiter = keep(wait); assert.equal(wait.status, 201);
  const w = await call(`/api/reservations/${waiter.id}`, { action: 'view', token: waiter.token });
  assert.equal(w.data.reservation.status, 'WAITLIST'); assert.equal(w.data.reservation.marketing_consent, true); checks++;
  const inv = await call('/api/reservations/inventory'); assert.equal(inv.data.variants.find((v) => v.name === 'S').available_stock, 0); checks++;
  const withdrawn = await call(`/api/reservations/${waiter.id}`, { action: 'marketing-withdraw', token: waiter.token });
  assert.equal(withdrawn.data.reservation.marketing_consent, false); checks++;
  const max = await call('/api/reservations', await body(3)); assert.equal(max.data.code, 'MAX_RESERVATION_QUANTITY'); checks++;
  assert.equal((await call('/api/commerce-admin')).status, 403); checks++;
  const anon = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const denied = await anon.from('commerce_campaign').select('*'); assert.ok(denied.error || denied.data.length === 0); checks++;
  const attempts = await db.from('reservation_payment_attempts').select('id', { count: 'exact', head: true }).in('reservation_id', created.map((r) => r.id));
  assert.ifError(attempts.error); assert.equal(attempts.count, 0); checks++;
  console.log(`${checks} HTTP checks passed, including concurrent final unit, WAITLIST, minimal data, optional marketing and zero Checkout attempts.`);
} finally {
  for (const own of created) {
    const result = await call(`/api/reservations/${own.id}`, { action: 'cancel', token: own.token });
    assert.equal(result.status, 200);
    const cleanup = await db.from('commerce_outbox').delete().eq('reservation_id', own.id).eq('status', 'PENDING'); assert.ifError(cleanup.error);
  }
  console.log('Synthetic pre-reservations cancelled and their pending emails removed.');
}
