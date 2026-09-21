import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { Resend } from 'resend';
const file = '.env.reservation-production.local';
const paths = [file, '.env.stripe-live.local', '.env.stripe-live.acct_1UCc4cDRITvLIOKF.local', '.env.local'];
const sources = paths.filter(existsSync).map(p=>parseEnv(readFileSync(p,'utf8')));
const valid = value => Boolean(value && value !== '[SENSITIVE]' && !value.includes('not_configured'));
const pick = key => sources.map(e=>e[key]).find(valid) ?? '';
const env = Object.fromEntries(Object.keys(sources[0]).filter(k=>valid(pick(k))).map(k=>[k,pick(k)]));
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
try {
  const keys = JSON.parse(execFileSync(process.execPath,[cli,'projects','api-keys','--project-ref','pjrqozlyrjgugdraoght','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));
  env.PUBLIC_SUPABASE_URL='https://pjrqozlyrjgugdraoght.supabase.co';
  env.PUBLIC_SUPABASE_ANON_KEY=keys.find(k=>k.name==='anon').api_key;
  env.SUPABASE_SERVICE_ROLE_KEY=keys.find(k=>k.name==='service_role').api_key;
  env.PUBLIC_SITE_URL='https://imperioes.com';
  env.RESERVATION_MODE='true'; env.SHIRT_SALES_APPROVED='false'; env.STRIPE_LIVE_CHECKOUT_ENABLED='false';
  env.RESERVATION_EXPIRATION_HOURS='0'; env.COMMERCE_EMAIL_MODE='live'; env.COMMERCE_TEST_EMAIL='';
  for(const key of ['RESERVATION_TOKEN_SECRET','COMMERCE_JOB_SECRET','RATE_LIMIT_SECRET']) env[key]=pick(key)||randomBytes(32).toString('hex');
  env.RESEND_API_KEY=pick('RESEND_API_KEY');
  env.RESEND_FROM_EMAIL='Imperio Espanol <contacto@imperioes.com>';
  env.MANIFESTO_FROM_EMAIL=env.RESEND_FROM_EMAIL;
  env.STRIPE_SECRET_KEY=pick('STRIPE_SECRET_KEY');
  // Only read the existing Live account; reservations never require new payment objects.
  assert.match(env.STRIPE_SECRET_KEY,/^(sk|rk)_live_/);
  const stripe=new Stripe(env.STRIPE_SECRET_KEY);
  const account=await stripe.accounts.retrieve();assert.equal(account.id,'acct_1UCc4cDRITvLIOKF');
  for(const key of ['STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ARCABUCERO_MONTHLY','STRIPE_PRICE_ARCABUCERO_ANNUAL','STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY','STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL','STRIPE_PRICE_CAMISETA_IMPERIAL']) env[key]=pick(key);
  const domains=await new Resend(env.RESEND_API_KEY).domains.list();
  assert.ok(!domains.error && domains.data.data.some(d=>d.name==='imperioes.com' && d.status==='verified'),'Verified sender domain required');
  writeFileSync(file,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});
  console.log(JSON.stringify({saved:file,project:'pjrqozlyrjgugdraoght',stripeAccount:account.id,reservationMode:true,shirtPayments:false,liveCheckout:false,verifiedSender:'contacto@imperioes.com',currentStripeSupport:account.business_profile?.support_email??null,remoteConfigurationChanged:false}));
} catch(error) {
  console.error(JSON.stringify({prepared:false,code:error.code??error.name,reason:error instanceof assert.AssertionError?error.message:'Production preparation failed; credentials omitted'}));process.exitCode=1;
}
