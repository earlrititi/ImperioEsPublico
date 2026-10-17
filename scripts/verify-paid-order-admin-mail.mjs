import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { Socket } from 'node:net';
Socket.prototype.connect = () => { throw Error('No real network in paid-order admin mail fixtures'); };
Object.assign(process.env, { COMMERCE_EMAIL_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_fixture', RESEND_API_KEY: 're_fixture',
  RESERVATION_TOKEN_SECRET: 'fixture', PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture' });
const id = '11111111-1111-4111-8111-111111111111';
const job = { order_id: id, status: 'PROCESSING', claim_id: id, encrypted_message: null };
const order = { id, stripe_checkout_session_id: 'cs_live_fixture', number: 'PED-FIXTURE', customer_name: 'Persona sintetica', customer_email: 'buyer@example.invalid',
  shipping_address: { name: 'Destinatario final', line1: 'Calle Final 12', postalCode: '28001', city: 'Madrid', province: '28' },
  total_quantity: 3, total: 8997, currency: 'eur', paid_at: '2026-10-12T10:00:00Z', status: 'READY_FOR_FULFILLMENT',
  commerce_order_items: [{ product_name: 'Camiseta Imperial', size: 'M', quantity: 1 }, { product_name: 'Camiseta Imperial', size: 'L', quantity: 2 }] };
const sends = [], receipts = [];
let providerFailure = true, receiptFailure = true;
const json = (data, status = 200) => Response.json(data, { status });
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
  const body = request.method === 'GET' ? null : await request.json();
  if (url.pathname === '/rest/v1/rpc/claim_paid_order_admin_notice') return json(job.status === 'SENT' ? [] : [{ ...job }]);
  if (url.pathname === '/rest/v1/commerce_orders') return json(order);
  if (url.pathname === '/rest/v1/paid_order_admin_outbox') {
    if (request.method === 'GET') return json([{ order_id: id, provider_id: 'email_fixture' }]);
    Object.assign(job, body); return json([{ order_id: id }]);
  }
  if (url.pathname === '/rest/v1/rpc/finish_paid_order_admin_notice') {
    if (receiptFailure) return json({ message: 'fixture unavailable' }, 503);
    job.status = 'SENT'; job.encrypted_message = null; return json(true);
  }
  if (url.pathname === '/rest/v1/admin_notification_history') { receipts.push(body); return json([]); }
  if (url.hostname === 'api.resend.com' && request.method === 'POST') {
    assert.deepEqual(body.to, 'earlrititi@gmail.com');
    assert.ok(!body.cc && !body.bcc); sends.push({ body, key: request.headers.get('idempotency-key') });
    if (providerFailure) return json({ name: 'application_error', message: 'fixture unavailable' }, 500);
    return json({ id: 'email_fixture' });
  }
  if (url.hostname === 'api.resend.com' && request.method === 'GET') return json({ id: 'email_fixture', last_event: 'delivered' });
  throw Error(`Unexpected mail fixture request ${request.method} ${url.pathname}`);
};
const directory = new URL('../.vercel/output/functions/_render.func/dist/server/chunks/', import.meta.url);
const name = readdirSync(directory).find(name => name.startsWith('paid-order-admin-mail_') && name.endsWith('.mjs'));
assert.ok(name);
const module = await import(new URL(name, directory).href);
const exported = name => Object.values(module).find(value => typeof value === 'function' && value.name === name);
const drain = exported('drainPaidOrderAdminMail'), reconcile = exported('reconcilePaidOrderAdminDelivery');
assert.ok(drain); assert.ok(reconcile);
assert.equal((await drain(1)).failed, 1); assert.ok(job.encrypted_message);
process.env.COMMERCE_EMAIL_MODE = 'test'; process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'; process.env.COMMERCE_TEST_EMAIL = 'sink@example.invalid';
assert.equal((await drain(1)).failed, 1); assert.equal(sends.length, 1, 'Saved Live snapshot must not send in Test');
process.env.COMMERCE_EMAIL_MODE = 'live'; process.env.STRIPE_SECRET_KEY = 'sk_live_fixture';
providerFailure = false;
assert.equal((await drain(1)).failed, 1); assert.equal(job.status, 'PROCESSING');
receiptFailure = false;
assert.equal((await drain(1)).sent, 1); assert.equal(job.status, 'SENT'); assert.equal(job.encrypted_message, null);
assert.equal(sends.length, 3); assert.deepEqual(sends[0], sends[1]); assert.deepEqual(sends[1], sends[2]);
assert.match(sends[2].body.text, /Destinatario final/); assert.match(sends[2].body.text, /Talla L: 2/);
assert.equal((await drain(1)).sent, 0);
assert.equal((await reconcile(1)).checked, 1); assert.equal(job.delivery_status, 'delivered'); assert.equal(receipts[0].delivery_status, 'delivered');
process.env.COMMERCE_EMAIL_MODE = 'disabled';
assert.equal((await drain(1)).disabled, true);
console.log('Paid-order owner notice: canonical items/address, recipient isolation, immutable retries, deduplication and delivery receipts passed. No real email.');
