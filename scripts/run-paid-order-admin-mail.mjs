import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'vite';

const { values } = parseArgs({ options: { mode: { type: 'string' }, 'env-dir': { type: 'string' }, order: { type: 'string' }, send: { type: 'boolean' } } });
assert.ok(['test', 'live'].includes(values.mode));
const envDir = resolve(values['env-dir'] ?? '.');
const env = parseEnv(readFileSync(join(envDir, `.env.reservation-${values.mode === 'live' ? 'production' : 'test'}.local`), 'utf8'));
const local = parseEnv(readFileSync(join(envDir, '.env.local'), 'utf8'));
const project = values.mode === 'live' ? 'pjrqozlyrjgugdraoght' : 'joicpkgvggfxzrdazisx';
assert.equal(env.PUBLIC_SUPABASE_URL, `https://${project}.supabase.co`);
assert.match(env.STRIPE_SECRET_KEY, values.mode === 'live' ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/);
if (values.order) assert.match(values.order, /^[a-f0-9-]{36}$/);
if (values.mode === 'test') assert.ok(values.order, 'Test delivery requires an exact order');
const recipient = values.mode === 'live' ? 'earlrititi@gmail.com' : 'delivered+imperio-pedido-admin@resend.dev';
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let query = db.from('paid_order_admin_outbox').select('order_id,status,provider_id').order('created_at');
if (values.order) query = query.eq('order_id', values.order);
else query = query.neq('status', 'SENT');
const jobs = await query;
assert.ifError(jobs.error);
assert.ok(jobs.data.length <= 100, 'Review unusually large recovery before sending');
const orders = [];
for (const job of jobs.data) {
  const order = await db.from('commerce_orders').select('id,reservation_id,total,stripe_checkout_session_id').eq('id', job.order_id).single();
  assert.ifError(order.error);
  const session = await stripe.checkout.sessions.retrieve(order.data.stripe_checkout_session_id);
  assert.equal(session.livemode, values.mode === 'live');
  assert.equal(session.payment_status, 'paid');
  assert.equal(session.amount_total, order.data.total);
  orders.push({ ...order.data, before: job });
}
console.log(JSON.stringify({ mode: values.mode, verifiedOrders: orders.length, recipient, send: !!values.send, customersWillBeEmailed: false }));
if (!values.send) process.exit(0);
const oldFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
  assert.ok([`${project}.supabase.co`, 'api.resend.com'].includes(url.hostname), `Unexpected host: ${url.hostname}`);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (url.hostname === 'api.resend.com') {
      assert.equal(url.pathname, '/emails');
      const message = await request.clone().json();
      assert.deepEqual([message.to].flat(), [recipient]); assert.ok(!message.cc && !message.bcc);
      assert.ok(request.headers.get('idempotency-key')?.startsWith('paid-order-admin-'));
    } else assert.ok(['/rest/v1/paid_order_admin_outbox', '/rest/v1/admin_notification_history',
      '/rest/v1/rpc/claim_paid_order_admin_notice', '/rest/v1/rpc/finish_paid_order_admin_notice'].includes(url.pathname), 'Unexpected database write');
  }
  return oldFetch(request);
};
Object.assign(process.env, env, { COMMERCE_EMAIL_MODE: values.mode, COMMERCE_TEST_EMAIL: recipient, RESEND_API_KEY: env.RESEND_API_KEY || local.RESEND_API_KEY });
const vite = await createServer({ configFile: false, envDir: false, envPrefix: 'PUBLIC_', logLevel: 'error', server: { middlewareMode: true, watch: null }, appType: 'custom' });
const reports = [];
try {
  const { drainPaidOrderAdminMail } = await vite.ssrLoadModule('/src/lib/paid-order-admin-mail.ts');
  const client = new Resend(process.env.RESEND_API_KEY);
  for (const order of orders) {
    const result = await drainPaidOrderAdminMail(1, order.id);
    const receipt = await db.from('paid_order_admin_outbox').select('status,provider_id,encrypted_message').eq('order_id', order.id).single();
    assert.ifError(receipt.error); assert.equal(receipt.data.status, 'SENT'); assert.equal(receipt.data.encrypted_message, null);
    assert.equal((await drainPaidOrderAdminMail(1, order.id)).sent, 0, 'Duplicate notice delivered');
    let event;
    for (let attempt = 0; attempt < 6; attempt++) {
      const provider = await client.emails.get(receipt.data.provider_id);
      assert.ifError(provider.error); assert.deepEqual([provider.data.to].flat(), [recipient]);
      for (const label of ['Nombre:', 'Direccion de envio:', 'Codigo postal:', 'Talla ', 'Cantidad total de camisetas:', 'Total pagado:']) assert.ok(provider.data.text.includes(label));
      event = provider.data.last_event;
      if (event === 'delivered') break;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    const update = await db.from('paid_order_admin_outbox').update({ delivery_status: event, provider_checked_at: new Date().toISOString() }).eq('order_id', order.id).eq('provider_id', receipt.data.provider_id);
    assert.ifError(update.error);
    const history = await db.from('admin_notification_history').update({ delivery_status: event }).eq('id', `paid_order_admin_${order.id}`);
    assert.ifError(history.error);
    reports.push({ orderId: order.id, providerId: receipt.data.provider_id, acceptedThisRun: result.sent, lastEvent: event, duplicateRunSent: 0 });
    await new Promise(resolve => setTimeout(resolve, 600));
  }
} finally { globalThis.fetch = oldFetch; await vite.close(); }
mkdirSync('tmp/paid-order-alerts', { recursive: true });
const path = `tmp/paid-order-alerts/${values.mode}-delivery.json`;
writeFileSync(path, JSON.stringify({ checkedAt: new Date().toISOString(), mode: values.mode, recipient, reports }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ path, accepted: reports.length, delivered: reports.filter(row => row.lastEvent === 'delivered').length,
  customerMailsSent: 0, paymentsCreated: 0, stockChanged: false }));
