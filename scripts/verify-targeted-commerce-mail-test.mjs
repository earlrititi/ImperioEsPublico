import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { createServer } from 'vite';

const { values } = parseArgs({ options: { 'state-file': { type: 'string' } } });
assert.match(values['state-file'] ?? '', /^tmp\/commercial-audit\/[a-z0-9-]+\.json$/);
const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
const local = parseEnv(readFileSync('.env.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
assert.match(env.STRIPE_SECRET_KEY, /^(sk|rk)_test_/);
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, 'false');
assert.ok(local.RESEND_API_KEY);
const state = JSON.parse(readFileSync(values['state-file'], 'utf8'));
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const session = await stripe.checkout.sessions.retrieve(state.sessionId);
assert.equal(session.livemode, false);
assert.equal(session.payment_status, 'paid');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const reservation = await db.from('reservations').select('id,customer_email,status,order_id').eq('id', state.id).single();
assert.ifError(reservation.error);
assert.match(reservation.data.customer_email, /@example\.invalid$/);
assert.equal(reservation.data.status, 'CONVERTED_TO_ORDER');
const order = await db.from('commerce_orders').select('id,stripe_checkout_session_id,total').eq('id', reservation.data.order_id).single();
assert.ifError(order.error);
assert.equal(order.data.stripe_checkout_session_id, session.id);
assert.equal(order.data.total, session.amount_total);

const sink = 'delivered+imperio-confirmacion@resend.dev';
Object.assign(process.env, env, { COMMERCE_EMAIL_MODE: 'test', COMMERCE_TEST_EMAIL: sink, RESEND_API_KEY: local.RESEND_API_KEY });
// Do not change any environment file or drain unrelated outbox rows.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  assert.ok([new URL(env.PUBLIC_SUPABASE_URL).hostname, 'api.resend.com'].includes(url.hostname), `Unexpected destination: ${url.hostname}`);
  assert.notEqual(url.pathname, '/rest/v1/rpc/claim_commerce_mail', 'Broad mail claim is forbidden in this test');
  if (url.hostname === 'api.resend.com' && request.method === 'POST') {
    assert.equal(url.pathname, '/emails');
    const body = await request.clone().json();
    assert.deepEqual([body.to].flat(), [sink]);
    assert.ok(!body.cc && !body.bcc);
  }
  return originalFetch(request);
};
// Never import the production build: its public Supabase URL is fixed at build time.
const vite = await createServer({ configFile: false, envDir: false, envPrefix: 'PUBLIC_', logLevel: 'error',
  server: { middlewareMode: true, watch: null }, appType: 'custom' });
const evidence = values['state-file'].replace(/\.json$/, '-mail.json');
let previous;
try { previous = JSON.parse(readFileSync(evidence, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const jobId = previous?.jobId ?? randomUUID();
if (!previous) {
  const inserted = await db.from('commerce_outbox').insert({ id: jobId, reservation_id: state.id, kind: 'ORDER_PAID', version: randomUUID() });
  assert.ifError(inserted.error);
  writeFileSync(evidence, JSON.stringify({ jobId, testOnly: true }), { mode: 0o600 });
}
try {
  const { drainCommerceMail: drain } = await vite.ssrLoadModule('/src/lib/commerce-mail.ts');
  if (previous) {
    const retry = await db.from('commerce_outbox').update({ status: 'PENDING' }).eq('id', jobId).eq('status', 'REVIEW')
      .is('first_attempt_at', null).is('encrypted_message', null);
    assert.ifError(retry.error);
  }
  const result = await drain(1, jobId);
  const receipt = await db.from('commerce_outbox').select('id,status,provider_id,encrypted_message').eq('id', jobId).single();
  assert.ifError(receipt.error);
  assert.equal(receipt.data.status, 'SENT', 'Targeted Test email was not accepted');
  assert.ok(receipt.data.provider_id);
  assert.equal(receipt.data.encrypted_message, null);
  assert.equal((await drain(1, jobId)).sent, 0, 'A sent job must not be delivered twice');
  const client = new Resend(local.RESEND_API_KEY);
  let delivered;
  for (let attempt = 0; attempt < 10; attempt++) {
    const response = await client.emails.get(receipt.data.provider_id);
    assert.ifError(response.error);
    assert.deepEqual([response.data.to].flat(), [sink]);
    assert.match(response.data.text, /Total pagado:/);
    assert.match(response.data.text, /maximo de 48 horas/);
    assert.match(response.data.text, /maximo de 7 dias laborables/);
    delivered = response.data.last_event;
    if (delivered === 'delivered') break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const report = { jobId, testOnly: true, provider: 'Resend', recipient: sink, providerId: receipt.data.provider_id,
    acceptedThisRun: result.sent, lastEvent: delivered, duplicateRunSent: 0, productionChanged: false, checkedAt: new Date().toISOString() };
  writeFileSync(evidence, JSON.stringify(report, null, 2), { mode: 0o600 });
  assert.equal(delivered, 'delivered', 'Provider delivery is not confirmed yet; do not call it delivered');
  console.log(JSON.stringify(report));
} finally {
  // Failed synthetic jobs stay for review, never for a future broad automatic drain.
  const cleanup = await db.from('commerce_outbox').update({ status: 'REVIEW' }).eq('id', jobId).neq('status', 'SENT');
  assert.ifError(cleanup.error);
  globalThis.fetch = originalFetch;
  await vite.close();
}
