import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(readFileSync('.env.reservation-production.local', 'utf8'));
assert.equal(env.PUBLIC_SITE_URL, 'https://imperioes.com');
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://pjrqozlyrjgugdraoght.supabase.co');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checks = [];
for (const host of ['imperioes.com', 'www.imperioes.com']) {
  for (const path of ['/', '/tienda', '/login', '/_astro/Overview.CK-yKIXu.js']) {
    const response = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    assert.equal(new URL(response.url).hostname, host);
    if (path.endsWith('.js')) assert.match(await response.text(), /Avisos de pedidos pendientes/);
    else await response.arrayBuffer();
    checks.push({ host, path, status: response.status });
  }
}
const unauthorized = await fetch(`${env.PUBLIC_SITE_URL}/api/commerce-maintenance`, { method: 'POST' });
assert.equal(unauthorized.status, 403);
const admin = await fetch(`${env.PUBLIC_SITE_URL}/api/admin/overview`);
assert.equal(admin.status, 403);
let maintenance;
if (process.argv.includes('--maintenance')) {
  assert.ok(env.COMMERCE_JOB_SECRET.length >= 32);
  const response = await fetch(`${env.PUBLIC_SITE_URL}/api/commerce-maintenance`, { method: 'POST',
    headers: { Authorization: `Bearer ${env.COMMERCE_JOB_SECRET}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200);
  maintenance = await response.json();
  assert.equal(maintenance.paidOrderAdminMail.disabled, false, 'Live worker must be enabled');
  assert.equal(maintenance.paidOrderAdminMail.failed, 0);
}
const queue = await db.from('paid_order_admin_outbox').select('order_id,status,provider_id,delivery_status');
assert.ifError(queue.error);
const orders = await db.from('commerce_orders').select('id,status,reservation_id');
assert.ifError(orders.error);
const receipts = await db.from('commerce_outbox').select('reservation_id,kind,status,provider_id,sent_at').eq('kind', 'ORDER_PAID');
assert.ifError(receipts.error);
const previous = JSON.parse(readFileSync('tmp/commercial-audit/paid-order-notices-2026-10-17.json', 'utf8'));
assert.ok(previous.orders.every(({ order, customerMail }) => receipts.data.some(row => row.reservation_id === order.reservation_id &&
  row.status === customerMail.status && row.provider_id === customerMail.provider_id && row.sent_at === customerMail.sent_at)), 'Original customer receipts changed');
const report = { checkedAt: new Date().toISOString(), commit: '41034b2d1a7cc11f08c8f72265f3fe35fe7db4c9', checks,
  protectedAdmin: true, protectedMaintenance: true, maintenance,
  ownerNotices: { total: queue.data.length, accepted: queue.data.filter(row => row.status === 'SENT').length,
    delivered: queue.data.filter(row => row.delivery_status === 'delivered').length,
    pending: queue.data.filter(row => row.status !== 'SENT').length },
  originalCustomerReceiptsUnchanged: true, ordersAwaitingPreparation: orders.data.filter(row => row.status === 'READY_FOR_FULFILLMENT').length };
mkdirSync('tmp/paid-order-alerts', { recursive: true });
writeFileSync('tmp/paid-order-alerts/production-verification.json', JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report));
