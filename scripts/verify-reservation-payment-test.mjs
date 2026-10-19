import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
assert.match(env.STRIPE_SECRET_KEY, /^(sk|rk)_test_/);
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, 'false');
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const base = 'http://127.0.0.1:4325';
const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'state-file': { type: 'string' }, 'multi-size': { type: 'boolean' } } });
if (values['state-file']) assert.match(values['state-file'], /^tmp\/commercial-audit\/[a-z0-9-]+\.json$/);
const file = values['state-file'] ?? '.codex-reservation-release/payment-test.json';
const rpc = async (name, args) => { const { data, error } = await db.rpc(name, args); assert.ifError(error); return data; };
const post = async (path, body) => {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
  const data = await response.json();
  assert.ok(response.ok, `Test request failed: ${response.status} ${data.code ?? ''}`);
  return data;
};
async function openTestCheckout(state) {
  assert.equal(state.finished, false);
  const total = (state.items ?? [{ sku: 'IE-CAMISETA-IMPERIAL-M', quantity: 1 }]).reduce((sum, item) => sum + item.quantity * 2999, 0);
  await post(`/api/reservations/${state.id}/checkout`, { token: state.token, address: state.address, confirmPurchase: true });
  const { data: attempt, error } = await db.from('reservation_payment_attempts').select('stripe_session_id').eq('reservation_id', state.id).single();
  assert.ifError(error);
  const session = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
  assert.equal(session.livemode, false);
  assert.equal(session.amount_total, total);
  assert.equal(session.total_details.amount_shipping, 0);
  Object.assign(state, { sessionId: session.id, checkoutUrl: session.url });
  writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  console.log(JSON.stringify({ reservation: state.id, testOnly: true, total, checkoutUrl: session.url }));
}
const mode = positionals[0];
if (mode === 'prepare') {
  // Refuse to overwrite recovery information from an earlier payment test.
  let previous;
  try { previous = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.ok(!previous || previous.finished, 'Finish the existing payment test before creating another');
  const ready = await fetch(`${base}/api/reservations/inventory`, { signal: AbortSignal.timeout(10000) });
  assert.equal(ready.status, 200, 'Start the isolated payment server before allocating Test stock');
  const customer = { name: 'Prueba Checkout Test sin envio', email: 'checkout-test@example.invalid' };
  const address = { name: customer.name, line1: 'Calle Pruebas 12', line2: 'PRUEBA SIN ENVIO', postalCode: '28001', city: 'Madrid', province: '28', country: 'ES' };
  const token = randomBytes(32).toString('hex');
  const items = [{ sku: 'IE-CAMISETA-IMPERIAL-M', quantity: 1 }, ...(values['multi-size'] ? [{ sku: 'IE-CAMISETA-IMPERIAL-L', quantity: 1 }] : [])];
  const id = await rpc('create_shirt_reservation', {
    p_request_id: randomUUID(), p_payload_hash: createHash('sha256').update(JSON.stringify(items)).digest('hex'),
    p_token_hash: createHash('sha256').update(token).digest('hex'), p_user_id: null,
    p_customer: customer, p_address: address, p_items: items,
    p_terms: '2026-09-12', p_privacy: '2026-09-12', p_expires_hours: 0,
  });
  const { data: campaign, error: campaignError } = await db.from('commerce_campaign').select('purchase_activated,purchase_open_at').eq('id', 'shirt-first-edition').single();
  assert.ifError(campaignError);
  const state = { id, token, address, items, finished: false, originalCampaign: campaign };
  writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  const enabled = await db.from('commerce_campaign').update({ purchase_activated: true, purchase_open_at: null }).eq('id', 'shirt-first-edition');
  assert.ifError(enabled.error);
  await rpc('open_shirt_purchase', { p_id: id });
  await openTestCheckout(state);
} else if (mode === 'checkout') {
  await openTestCheckout(JSON.parse(readFileSync(file, 'utf8')));
} else if (mode === 'verify') {
  const state = JSON.parse(readFileSync(file, 'utf8'));
  const expectedItems = (state.items ?? [{ sku: 'IE-CAMISETA-IMPERIAL-M', quantity: 1 }]).map(item => ({ ...item, line_total: item.quantity * 2999 }));
  const total = expectedItems.reduce((sum, item) => sum + item.line_total, 0);
  const session = await stripe.checkout.sessions.retrieve(state.sessionId);
  assert.equal(session.livemode, false);
  assert.equal(session.payment_status, 'paid');
  const { data: order, error } = await db.from('commerce_orders').select('id,status,total,vat_amount,stripe_checkout_session_id').eq('reservation_id', state.id).single();
  assert.ifError(error);
  assert.equal(order.total, total);
  assert.ok(order.vat_amount > 0);
  assert.equal(order.stripe_checkout_session_id, state.sessionId);
  assert.equal(order.status, 'READY_FOR_FULFILLMENT');
  const { data: reservation, error: re } = await db.from('reservations').select('status,order_id').eq('id', state.id).single();
  assert.ifError(re);
  assert.equal(reservation.status, 'CONVERTED_TO_ORDER');
  assert.equal(reservation.order_id, order.id);
  const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 100 });
  const event = events.data.find((event) => event.data.object.id === state.sessionId);
  assert.ok(event, 'Stripe completed event missing');
  const { data: receipt, error: we } = await db.from('stripe_webhook_events').select('status').eq('event_id', event.id).single();
  assert.ifError(we);
  assert.equal(receipt.status, 'completed');
  const { data: items, error: ie } = await db.from('commerce_order_items').select('sku,quantity,line_total').eq('order_id', order.id);
  assert.ifError(ie);
  assert.deepEqual(items.sort((a,b)=>a.sku.localeCompare(b.sku)), expectedItems.sort((a,b)=>a.sku.localeCompare(b.sku)));
  const { data: inventories, error: se } = await db.from('product_variants').select('sku,physical_stock,reserved_stock,sold_stock,available_stock').in('sku', items.map(item=>item.sku));
  assert.ifError(se);
  assert.equal(inventories.length, items.length);
  for (const inventory of inventories) {
    assert.ok(inventory.sold_stock >= items.find(item=>item.sku===inventory.sku).quantity);
    assert.equal(inventory.available_stock, inventory.physical_stock - inventory.reserved_stock - inventory.sold_stock);
  }
  const inventory = inventories[0];
  // Retain the paid Test order as evidence, but never send its synthetic emails later.
  const deleted = await db.from('commerce_outbox').delete().eq('reservation_id', state.id).eq('status', 'PENDING');
  assert.ifError(deleted.error);
  if (state.originalCampaign) {
    const restored = await db.from('commerce_campaign').update(state.originalCampaign).eq('id', 'shirt-first-edition');
    assert.ifError(restored.error);
  }
  const report = { testOnly: true, paid: true, order, reservation, items, inventory, inventories, webhook: receipt, event: event.id };
  state.finished = true;
  writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  writeFileSync(file.replace(/\.json$/, '-result.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
} else if (mode === 'cancel') {
  const state = JSON.parse(readFileSync(file, 'utf8'));
  const { data: attempts, error } = await db.from('reservation_payment_attempts').select('id,stripe_session_id').eq('reservation_id', state.id).eq('status', 'OPEN');
  assert.ifError(error);
  for (const attempt of attempts) {
    assert.ok(attempt.stripe_session_id, 'Reconcile missing Session before releasing stock');
    let session = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
    assert.equal(session.livemode, false);
    if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id);
    assert.equal(session.status, 'expired', 'Paid Test orders must be retained and reconciled, not cancelled as unpaid');
    await rpc('close_shirt_payment', { p_attempt: attempt.id, p_session: session.id, p_expired: true });
  }
  await rpc('release_shirt_reservation', { p_id: state.id, p_status: 'CANCELLED' });
  const deleted = await db.from('commerce_outbox').delete().eq('reservation_id', state.id).eq('status', 'PENDING');
  assert.ifError(deleted.error);
  if (state.originalCampaign) {
    const restored = await db.from('commerce_campaign').update(state.originalCampaign).eq('id', 'shirt-first-edition');
    assert.ifError(restored.error);
  }
  state.finished = true;
  writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
  console.log('Unpaid Test reservation cancelled; its stock released.');
} else throw new Error('Use prepare, checkout, verify or cancel');
