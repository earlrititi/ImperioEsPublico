import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
assert.match(env.STRIPE_SECRET_KEY, /^(sk|rk)_test_/);
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, 'false');
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const file = 'tmp/commercial-audit/browser-purchase-test.json';
const mode = process.argv[2];
const check = result => { assert.ifError(result.error); return result.data; };
const save = state => writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
const restore = async state => check(await db.from('commerce_campaign').update(state.originalCampaign).eq('id', 'shirt-first-edition'));

if (mode === 'prepare') {
  let previous;
  try { previous = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.ok(!previous || previous.finished, 'Finish the previous browser Test first');
  const response = await fetch('http://127.0.0.1:4325/api/reservations/inventory');
  assert.equal(response.status, 200, 'Start the isolated Test server first');
  const originalCampaign = check(await db.from('commerce_campaign').select('purchase_activated,purchase_open_at').eq('id', 'shirt-first-edition').single());
  const state = { startedAt: new Date().toISOString(), finished: false, originalCampaign,
    email: `browser-test-${randomUUID().slice(0, 8)}@example.invalid`,
    name: 'Prueba navegador SIN ENVIO',
    items: [{ sku: 'IE-CAMISETA-IMPERIAL-M', quantity: 1 }, { sku: 'IE-CAMISETA-IMPERIAL-L', quantity: 1 }] };
  mkdirSync('tmp/commercial-audit', { recursive: true });
  save(state);
  check(await db.from('commerce_campaign').update({ purchase_activated: true, purchase_open_at: null }).eq('id', 'shirt-first-edition'));
  console.log(JSON.stringify({ testOnly: true, url: 'http://127.0.0.1:4325/tienda', name: state.name, email: state.email,
    address: 'Calle Pruebas 12, PRUEBA SIN ENVIO, 28001 Madrid', expected: 'M x 1 + L x 1; 59,98 EUR; Stripe TEST only' }));
} else if (mode === 'verify' || mode === 'cancel') {
  const state = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(state.finished, false);
  const reservations = check(await db.from('reservations').select('id,status,order_id').eq('customer_email', state.email).gte('created_at', state.startedAt));
  assert.ok(reservations.length <= 1, 'Unexpected duplicate browser reservation');
  const reservation = reservations[0];
  if (!reservation) {
    assert.equal(mode, 'cancel', 'Submit the browser form before verifying');
    await restore(state); state.finished = true; save(state);
    console.log('Test campaign restored; no reservation was created.');
    process.exit(0);
  }
  const attempts = check(await db.from('reservation_payment_attempts').select('id,stripe_session_id,status').eq('reservation_id', reservation.id));
  assert.ok(attempts.length <= 1);
  const attempt = attempts[0];
  if (mode === 'cancel') {
    if (attempt?.stripe_session_id) {
      let session = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
      assert.equal(session.livemode, false);
      if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id);
      assert.equal(session.status, 'expired', 'A paid Test order must be verified, not cancelled');
      check(await db.rpc('close_shirt_payment', { p_attempt: attempt.id, p_session: session.id, p_expired: true }));
    }
    check(await db.rpc('release_shirt_reservation', { p_id: reservation.id, p_status: 'CANCELLED' }));
  } else {
    assert.ok(attempt?.stripe_session_id);
    const session = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
    assert.equal(session.livemode, false);
    assert.equal(session.payment_status, 'paid');
    assert.equal(session.amount_total, 5998);
    assert.equal(session.currency, 'eur');
    const order = check(await db.from('commerce_orders').select('id,status,total,vat_amount,shipping_address,stripe_checkout_session_id').eq('reservation_id', reservation.id).single());
    assert.equal(order.status, 'READY_FOR_FULFILLMENT');
    assert.equal(order.total, 5998);
    assert.equal(order.stripe_checkout_session_id, session.id);
    assert.equal(reservation.status, 'CONVERTED_TO_ORDER');
    assert.equal(reservation.order_id, order.id);
    const items = check(await db.from('commerce_order_items').select('sku,quantity,line_total').eq('order_id', order.id));
    assert.deepEqual(items.map(({sku, quantity}) => ({sku, quantity})).sort((a,b) => a.sku.localeCompare(b.sku)), [...state.items].sort((a,b) => a.sku.localeCompare(b.sku)));
    const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 100 });
    const event = events.data.find(row => row.data.object.id === session.id);
    assert.ok(event);
    const receipt = check(await db.from('stripe_webhook_events').select('status').eq('event_id', event.id).single());
    assert.equal(receipt.status, 'completed');
    const stock = check(await db.from('product_variants').select('sku,physical_stock,reserved_stock,sold_stock,available_stock').in('sku', state.items.map(row => row.sku)));
    for (const row of stock) assert.equal(row.available_stock, row.physical_stock - row.reserved_stock - row.sold_stock);
    const notices = check(await db.from('paid_order_admin_outbox').select('order_id,status').eq('order_id', order.id));
    assert.equal(notices.length, 1);
    state.result = { testOnly: true, paid: true, orderId: order.id, total: order.total, vat: order.vat_amount, items, stock, webhookCompleted: true, ownerNoticeQueued: true };
  }
  // Only this synthetic Test reservation is cleaned; no real customer mail can be sent.
  check(await db.from('commerce_outbox').delete().eq('reservation_id', reservation.id).eq('status', 'PENDING'));
  await restore(state);
  state.finished = true; save(state);
  console.log(JSON.stringify(state.result ?? { testOnly: true, cancelled: true, stockReleased: true }));
} else throw new Error('Use prepare, verify or cancel');
