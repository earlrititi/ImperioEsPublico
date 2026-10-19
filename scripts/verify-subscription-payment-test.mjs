import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
assert.ok(/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? ''), 'A Stripe Test key is required');
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED, 'false');
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const file = 'tmp/commercial-audit/subscription-payment-test.json';
const mode = process.argv[2];
const check = result => { assert.ifError(result.error); return result.data; };
const save = state => writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
async function deliveredReceipts(state) {
  const local = parseEnv(readFileSync('.env.local', 'utf8'));
  const resend = new Resend(env.RESEND_API_KEY || local.RESEND_API_KEY);
  const listed = await resend.emails.list({ limit: 100 }); assert.ifError(listed.error);
  const messages = listed.data.data.filter(m => m.subject.includes(`[run:${state.runId}]`));
  assert.ok(messages.length >= 3, 'Expect welcome, contractual discount and owner paid notice');
  const receipts = [];
  for (const message of messages) {
    const receipt = await resend.emails.get(message.id); assert.ifError(receipt.error);
    const mail = receipt.data;
    assert.deepEqual(mail.to.map(v => v.toLowerCase()), [state.testRecipient]);
    assert.ok(!mail.cc?.length && !mail.bcc?.length);
    if (mail.subject.includes('pago recibido')) {
      for (const field of ['Prueba Suscripcion SIN COBRO REAL','Calle Pruebas 12','28001','Madrid',state.email,'Anual',state.invoiceId]) {
        assert.ok(mail.text?.includes(field), 'Owner notice must contain final billing identity, address, plan and invoice');
      }
    }
    receipts.push({ id: mail.id, subject: mail.subject, state: mail.last_event });
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  assert.ok(receipts.every(m => ['delivered','opened','clicked'].includes(m.state)), 'Wait for provider delivery receipts');
  assert.equal(receipts.filter(m => m.subject.includes('pago recibido')).length, 1, 'One owner paid notice');
  assert.equal(receipts.filter(m => m.subject.includes('esta activa')).length, 1, 'One buyer welcome');
  assert.equal(receipts.filter(m => m.subject.includes('Tu 20%')).length, 1, 'One contractual discount');
  return receipts;
}
const plans = [
  ['arcabucero-monthly', 'STRIPE_PRICE_ARCABUCERO_MONTHLY', 199, 'month'],
  ['arcabucero-annual', 'STRIPE_PRICE_ARCABUCERO_ANNUAL', 1799, 'year'],
  ['maestre-campo-monthly', 'STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY', 399, 'month'],
  ['maestre-campo-annual', 'STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL', 3799, 'year'],
];

if (mode === 'prepare') {
  let old;
  try { old = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.ok(!old || old.finished, 'Finish the previous subscription Test before preparing another');
  const runId = randomUUID();
  const email = `subscription-browser-${runId.slice(0, 8)}@example.invalid`;
  const password = `Test-Only-${randomBytes(24).toString('base64url')}!`;
  const state = { runId, email, password, startedAt: new Date().toISOString(), finished: false, priceEnv: {}, selectedPlan: 'maestre-campo-annual' };
  mkdirSync('tmp/commercial-audit', { recursive: true });
  save(state);
  for (const [plan, key, amount, interval] of plans) {
    const lookup = `imperio_e_subscription_browser_test_${plan}_v1`;
    let price = (await stripe.prices.list({ active: true, lookup_keys: [lookup], limit: 1 })).data[0];
    if (!price) {
      const product = await stripe.products.create({ name: `Imperio E TEST - ${plan}`, metadata: { purpose: 'subscription-browser-test' } }, { idempotencyKey: `${lookup}-product` });
      price = await stripe.prices.create({ product: product.id, currency: 'eur', unit_amount: amount, recurring: { interval },
        tax_behavior: 'inclusive', lookup_key: lookup }, { idempotencyKey: `${lookup}-price` });
    }
    assert.equal(price.livemode, false); assert.equal(price.unit_amount, amount); assert.equal(price.currency, 'eur');
    assert.equal(price.recurring.interval, interval); assert.equal(price.recurring.interval_count, 1);
    state.priceEnv[key] = price.id;
    save(state);
  }
  const result = check(await db.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { name: 'Prueba Suscripcion SIN COBRO REAL', integration_test: true } }));
  Object.assign(state, { email, password, userId: result.user.id }); save(state);
  console.log(JSON.stringify({ testOnly: true, fixturePrepared: true, configuredPlans: plans.map(([plan,,amount,interval]) => ({ plan, amount, interval })),
    checkoutUrl: 'http://127.0.0.1:4325/checkout/maestre-campo-annual', realCharges: 0 }));
} else if (mode === 'status') {
  const state = JSON.parse(readFileSync(file, 'utf8'));
  console.log(JSON.stringify({ testOnly: true, syntheticEmail: state.email, finished: state.finished, plan: state.selectedPlan }));
} else if (mode === 'report') {
  const state = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(state.finished, true); assert.equal(state.cleanupVerified, true); assert.equal(state.password, undefined);
  assert.equal(state.mailReceipts.length, 4); assert.equal(state.replayedActualEventDeduplicated, true);
  const summary = { date: '2026-10-18', scope: 'actual hosted Maestre annual Test checkout; other three prices validated but not paid',
    ...state.result, realCharges: 0, productionDataChanged: false, productionSchemaChanged: false,
    stripeMode: 'test', supabaseProject: 'joicpkgvggfxzrdazisx',
    browserCheckout: 'guest', browserReturn: 'sign_in required, not a false premium activation',
    passwordLoginAndPremiumAccess: 'verified over HTTP against the actual application with the synthetic Test account',
    liveConfigurationChanged: false, marketingActivated: false, paymentEventReplayDeduplicated: true,
    emailDelivery: { count: 4, buyerWelcome: 1, contractualDiscount: 1, ownerPaidNotice: 1, testCancellation: 1,
      allDeliveredToSingleApprovedTestSink: true, customerNamesAddressesAndInvoiceCheckedInOwnerNotice: true, duplicates: 0 },
    cleanup: { subscriptionCancelled: true, databaseAccessRevoked: true, plaintextPasswordRemoved: true,
      syntheticEvidenceRetained: true, productionAccountsDeleted: 0 },
    webRelease: 'local changes not published',
    limitations: ['Google Analytics subscription purchase measurement is still pending', 'legal review before the full release',
      'other three subscription variants have no full hosted payment proof in this run', 'browser helper sign-in blocked; helper removed without changing browser protections'] };
  const summaryFile = 'tmp/commercial-audit/subscription-payment-summary-2026-10-18.json';
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ testOnly: true, report: summaryFile, emailsDelivered: 4, realCharges: 0, secretsInReport: false }));
} else if (['verify', 'finish', 'receipts', 'finalize', 'replay'].includes(mode)) {
  const state = JSON.parse(readFileSync(file, 'utf8'));
  assert.match(state.email, /^subscription-browser-[a-f0-9]{8}@example\.invalid$/);
  const claim = check(await db.from('subscription_checkouts').select('stripe_session_id').eq('email', state.email).maybeSingle());
  if (!claim?.stripe_session_id) {
    assert.equal(mode, 'finish', 'Complete the browser checkout first');
    state.finished = true; delete state.password; save(state);
    console.log('No subscription checkout created. Test fixture closed; no accounts deleted.');
    process.exit(0);
  }
  const checkout = await stripe.checkout.sessions.retrieve(claim.stripe_session_id);
  assert.equal(checkout.livemode, false); assert.equal(checkout.mode, 'subscription');
  const subscriptionId = typeof checkout.subscription === 'string' ? checkout.subscription : checkout.subscription?.id;
  if (mode === 'finalize') {
    assert.equal(state.finished, true); assert.equal(state.subscriptionId, subscriptionId);
    assert.equal(state.password, undefined);
    assert.equal((await stripe.subscriptions.retrieve(subscriptionId)).status, 'canceled');
    const row = check(await db.from('subscriptions').select('status,user_id').eq('stripe_subscription_id', subscriptionId).single());
    assert.equal(row.status, 'canceled'); assert.equal(row.user_id, state.userId);
    const events = await stripe.events.list({type:'customer.subscription.deleted',limit:100});
    const event = events.data.find(e=>e.data.object.id===subscriptionId); assert.ok(event);
    assert.equal(check(await db.from('stripe_webhook_events').select('status').eq('event_id',event.id).single()).status,'completed');
    state.mailReceipts = await deliveredReceipts(state);
    assert.equal(state.mailReceipts.filter(m=>m.subject.includes('cancelada')).length,1);
    state.cleanupVerified = true; save(state);
    console.log(JSON.stringify({testOnly:true,cleanupVerified:true,subscriptionCancelled:true,databaseAccessRevoked:true,credentialsRemoved:true,emailsDelivered:state.mailReceipts.length,realCharges:0}));
    process.exit(0);
  }
  if (mode === 'finish') {
    if (checkout.status === 'open') await stripe.checkout.sessions.expire(checkout.id);
    if (subscriptionId) {
      const current = await stripe.subscriptions.retrieve(subscriptionId);
      assert.equal(current.livemode, false);
      if (current.status !== 'canceled') await stripe.subscriptions.cancel(subscriptionId);
    }
    Object.assign(state, { subscriptionId, finished: true, finishedAt: new Date().toISOString() });
    delete state.password; save(state);
    console.log(JSON.stringify({ testOnly: true, finished: true, recurringSubscriptionCancelled: Boolean(subscriptionId), realCharges: 0, retainedTestEvidence: true }));
    process.exit(0);
  }
  assert.equal(checkout.status, 'complete'); assert.equal(checkout.payment_status, 'paid'); assert.equal(checkout.amount_total, 3799);
  assert.ok(checkout.total_details.amount_tax > 0); assert.ok([state.userId, null].includes(checkout.client_reference_id));
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  assert.equal(subscription.livemode, false); assert.equal(subscription.status, 'active');
  assert.equal(subscription.metadata.plan, 'maestre_campo'); assert.equal(subscription.metadata.billingInterval, 'year');
  assert.ok([state.userId, '', undefined].includes(subscription.metadata.userId));
  assert.equal(subscription.items.data[0].price.id, state.priceEnv.STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL);
  const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice.id;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  assert.equal(invoice.status, 'paid'); assert.equal(invoice.amount_paid, 3799); assert.equal(invoice.billing_reason, 'subscription_create');
  const rows = check(await db.from('subscriptions').select('id,user_id,plan,status,billing_interval,stripe_subscription_id').eq('email', state.email));
  assert.equal(rows.length, 1); assert.equal(rows[0].user_id, state.userId); assert.equal(rows[0].status, 'active');
  assert.equal(rows[0].plan, 'maestre_campo'); assert.equal(rows[0].billing_interval, 'year'); assert.equal(rows[0].stripe_subscription_id, subscriptionId);
  const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 100 });
  const event = events.data.find(e => e.data.object.id === checkout.id); assert.ok(event);
  const ledger = check(await db.from('stripe_webhook_events').select('status').eq('event_id', event.id).single());
  assert.equal(ledger.status, 'completed');
  if (mode === 'replay') {
    const cli = join(process.env.LOCALAPPDATA, 'ImperioETools/stripe/stripe.exe');
    const secret = execFileSync(cli, ['listen','--print-secret'], { env: { ...process.env, STRIPE_API_KEY: env.STRIPE_SECRET_KEY },
      encoding:'utf8',windowsHide:true,timeout:30000,stdio:['ignore','pipe','pipe'] }).trim();
    assert.ok(/^whsec_\S+$/.test(secret), 'A Test listener signing secret is required');
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({payload,secret});
    const response = await fetch('http://127.0.0.1:4325/api/stripe-webhook', {method:'POST',headers:{'stripe-signature':signature,'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200); assert.equal((await response.json()).duplicate,true);
    state.replayedActualEventDeduplicated = true; save(state);
    console.log(JSON.stringify({testOnly:true,actualStripeEventReplayed:true,duplicateIgnored:true,realCharges:0}));
    process.exit(0);
  }
  const base = 'http://127.0.0.1:4325';
  const login = await fetch(`${base}/login?next=/premium`, { method: 'POST', redirect: 'manual',
    headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: state.email, password: state.password }), signal: AbortSignal.timeout(15000) });
  assert.equal(login.status, 303); assert.equal(login.headers.get('location'), '/premium');
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; '); assert.ok(cookie);
  const access = await fetch(`${base}/api/subscriptions/status`, { headers: { Cookie: cookie } });
  assert.equal(access.status, 200); assert.equal((await access.json()).state, 'active');
  const path = '/papeles-y-tratados/cruz-de-borgona-historia';
  const marker = 'Un martirio convertido en emblema';
  const anonymous = await fetch(base + path); assert.equal(anonymous.status, 200);
  assert.ok(!(await anonymous.text()).includes(marker));
  const premium = await fetch(base + path, { headers: { Cookie: cookie } });
  assert.equal(premium.status, 200); assert.ok((await premium.text()).includes(marker));
  assert.equal(premium.headers.get('cache-control'), 'private, no-store');
  const duplicate = await fetch(`${base}/api/create-checkout-session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ email: state.email, plan: 'arcabucero-monthly', requestId: randomUUID(), anonymousId: randomUUID(),
      consents: { terms: true, privacy: true, immediateAccess: true, withdrawalAcknowledgement: true } }) });
  assert.equal(duplicate.status, 409); assert.equal((await duplicate.json()).code, 'SUBSCRIPTION_ALREADY_EXISTS');
  const owner = check(await db.from('stripe_webhook_events').select('status').eq('event_id', `admin_subscription_${subscriptionId}`).single());
  assert.equal(owner.status, 'completed');
  const lead = check(await db.from('marketing_leads').select('stripe_coupon_id,email_sent_at,marketing_accepted_at').eq('email', state.email).single());
  assert.match(lead.stripe_coupon_id, /maestre_campo.*20/); assert.ok(lead.email_sent_at); assert.equal(lead.marketing_accepted_at, null);
  Object.assign(state, { checkoutId: checkout.id, subscriptionId, invoiceId, verifiedAt: new Date().toISOString(),
    result: { amount: 3799, tax: checkout.total_details.amount_tax, plan: 'maestre_campo', interval: 'year',
      activeDatabaseSubscriptions: rows.length, webhookCompleted: true, ownerNoticeCompleted: true, shirtDiscountPercent: 20, marketingOptIn: false,
      actualPasswordLogin: true, anonymousPremiumBodyBlocked: true, paidPremiumBodyAvailable: true, secondSubscriptionBlocked: true } });
  if (mode === 'receipts') {
    state.mailReceipts = await deliveredReceipts(state);
  }
  save(state);
  console.log(JSON.stringify({ testOnly: true, ...state.result, emailsDelivered: state.mailReceipts?.length ?? 'not_checked', realCharges: 0 }));
} else throw Error('Use prepare, status, verify, receipts, replay, finish, finalize or report');
