import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(readFileSync('.env.reservation-production.local', 'utf8'));
const local = parseEnv(readFileSync('.env.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://pjrqozlyrjgugdraoght.supabase.co');
assert.match(env.STRIPE_SECRET_KEY, /^(sk|rk)_live_/);
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const resend = new Resend(env.RESEND_API_KEY || local.RESEND_API_KEY);
const orders = await db.from('commerce_orders').select('*,commerce_order_items(*)').order('paid_at');
assert.ifError(orders.error);
const outbox = await db.from('commerce_outbox').select('reservation_id,kind,status,provider_id,sent_at');
assert.ifError(outbox.error);
const history = await db.from('admin_notification_history').select('id,kind,customer_email,subject,delivery_status');
assert.ifError(history.error);
const rows = [];
for (const order of orders.data) {
  const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
  assert.equal(session.livemode, true);
  assert.equal(session.payment_status, 'paid');
  assert.equal(session.amount_total, order.total);
  const mail = outbox.data.find(row => row.reservation_id === order.reservation_id && row.kind === 'ORDER_PAID');
  let provider;
  if (mail?.provider_id) {
    const response = await resend.emails.get(mail.provider_id);
    if (response.error) provider = { lookupError: response.error.name };
    else provider = { recipients: response.data.to, lastEvent: response.data.last_event };
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  rows.push({ order, stripePaid: true, customerMail: mail, customerReceipt: provider,
    ownerNotices: history.data.filter(row => row.kind === 'paid_order' && row.id.includes(order.id)) });
}
const balance = await stripe.balance.retrieve();
mkdirSync('tmp/commercial-audit', { recursive: true });
const path = 'tmp/commercial-audit/paid-order-notices-2026-10-17.json';
writeFileSync(path, JSON.stringify({ asOf: new Date().toISOString(), readOnly: true, orders: rows,
  balance: { available: balance.available, pending: balance.pending } }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ path, paidOrders: rows.length, grossCents: rows.reduce((n, row) => n + row.order.total, 0),
  shirtUnits: rows.reduce((n, row) => n + row.order.total_quantity, 0),
  customerMailsAccepted: rows.filter(row => row.customerMail?.status === 'SENT').length,
  ownerPaidOrderNoticesRecorded: rows.reduce((n, row) => n + row.ownerNotices.length, 0),
  customerReceiptsSentToOwner: rows.filter(row => row.customerReceipt?.recipients?.includes('earlrititi@gmail.com')).length,
  availableBalance: balance.available.map(row => ({ currency: row.currency, amount: row.amount })), productionChanged: false }));
