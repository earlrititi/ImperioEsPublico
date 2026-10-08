import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(readFileSync('.env.reservation-test.local','utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL,'https://joicpkgvggfxzrdazisx.supabase.co');
assert.match(env.STRIPE_SECRET_KEY,/^(sk|rk)_test_/);
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id,'acct_1UCc4cDRITvLIOKF');
const db = createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const probe = await db.from('subscription_checkouts').select('attempt_id').limit(1);
if(probe.error) throw new Error('Apply migration 022 in Test before running this verification');
let price = (await stripe.prices.list({lookup_keys:['imperio_admin_checkout_test_monthly_v1'],active:true,limit:1})).data[0];
if(!price) {
  const product = await stripe.products.create({name:'Imperio E - subscription guard TEST',metadata:{purpose:'automated-checkout-test'}},{idempotencyKey:'imperio-admin-checkout-test-product-v1'});
  price = await stripe.prices.create({product:product.id,currency:'eur',unit_amount:199,recurring:{interval:'month'},lookup_key:'imperio_admin_checkout_test_monthly_v1'},{idempotencyKey:'imperio-admin-checkout-test-price-v1'});
}
assert.equal(price.livemode,false);
const directory = mkdtempSync(join(tmpdir(),'imperio-checkout-verify-'));
const bundle = join(directory,'checkout.cjs');
const sessions = new Set();
const email = `checkout-${randomUUID()}@example.invalid`;
try {
  await build({entryPoints:['src/lib/subscription-checkout.ts'],outfile:bundle,bundle:true,platform:'node',format:'cjs',logLevel:'silent',define:{'import.meta.env':JSON.stringify({...env,SSR:true})}});
  const {guardedSubscriptionCheckout} = createRequire(import.meta.url)(bundle);
  const parameters = {mode:'subscription',customer_email:email,line_items:[{price:price.id,quantity:1}],success_url:'https://imperioes.com/gracias',cancel_url:'https://imperioes.com/suscribirse'};
  // Deliberate simultaneous calls exercise the database mutex and Stripe idempotency.
  const outcomes = await Promise.allSettled(Array.from({length:4},()=>guardedSubscriptionCheckout(stripe,email,'arcabucero',null,parameters)));
  for(const outcome of outcomes) if(outcome.status==='fulfilled') sessions.add(outcome.value.id);
  assert.ok(sessions.size===1,'Concurrent checkout calls must produce exactly one payable session');
  const retry = await guardedSubscriptionCheckout(stripe,email,'arcabucero',null,parameters);
  assert.ok(sessions.has(retry.id),'Retry must reuse the same session');
  await assert.rejects(guardedSubscriptionCheckout(stripe,email,'maestre_campo',null,parameters),/CHECKOUT_ALREADY_OPEN/);
  await stripe.checkout.sessions.expire(retry.id);
  const replacement = await guardedSubscriptionCheckout(stripe,email,'arcabucero',null,parameters);
  sessions.add(replacement.id);
  assert.notEqual(replacement.id,retry.id,'Confirmed expiry must allow a new checkout');
  assert.equal(replacement.livemode,false);
  assert.equal(replacement.payment_status,'unpaid');
  console.log(JSON.stringify({passed:true,mode:'test',checks:['concurrent deduplication','retry reuse','different-plan exclusion','confirmed expiry replacement'],charges:0}));
} finally {
  // Remove only fixtures created by this invocation, always in the asserted Test project.
  for(const id of sessions) {
    const session = await stripe.checkout.sessions.retrieve(id);
    if(session.status==='open') await stripe.checkout.sessions.expire(id);
  }
  const removed = await db.from('subscription_checkouts').delete().eq('email',email);
  if(removed.error) console.error('Test fixture cleanup needs review');
  rmSync(bundle,{force:true});
}
