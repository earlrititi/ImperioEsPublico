import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import Stripe from 'stripe';
const e=parseEnv(readFileSync('.env.reservation-test.local','utf8'));
assert.equal(e.PUBLIC_SUPABASE_URL,'https://joicpkgvggfxzrdazisx.supabase.co');
assert.match(e.STRIPE_SECRET_KEY,/^sk_test_/);
const project=JSON.parse(readFileSync('.vercel/project.json','utf8'));
assert.equal(project.projectId,'prj_sGnSgdWDmz3kzD8yHidTtA1US8DH');
if(!process.argv.includes('--apply')) {console.log('Dry run: configure isolated Preview only; production unchanged. Pass --apply.');process.exit(0);}
const stripe=new Stripe(e.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id,'acct_1UCc4cDRITvLIOKF');
const values={};
for(const key of ['PUBLIC_SUPABASE_URL','PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_CAMISETA_IMPERIAL','STRIPE_ES_VAT_RATE_ID','RESERVATION_TOKEN_SECRET','COMMERCE_JOB_SECRET']){
  assert.ok(e[key],`Missing Test ${key}`);values[key]=e[key];
}
values.RATE_LIMIT_SECRET=e.RATE_LIMIT_SECRET||e.RESERVATION_TOKEN_SECRET;
Object.assign(values,{COMMERCE_EMAIL_MODE:'disabled',RESEND_API_KEY:'re_preview_disabled',RESEND_FROM_EMAIL:'Imperio E <contacto@imperioes.com>',
  PUBLIC_SITE_URL:'https://imperio-espa-ol-deploy-git-preview-earlrititi-2806s-projects.vercel.app',
  RESERVATION_MODE:'true',SHIRT_SALES_APPROVED:'false',STRIPE_LIVE_CHECKOUT_ENABLED:'false'});
for(const [plan,amount,interval,name] of [['arcabucero',199,'month','ARCABUCERO_MONTHLY'],['arcabucero',1799,'year','ARCABUCERO_ANNUAL'],['maestre_campo',399,'month','MAESTRE_CAMPO_MONTHLY'],['maestre_campo',3799,'year','MAESTRE_CAMPO_ANNUAL']]){
  const lookup=`imperio_preview_${plan}_${interval}_v1`;
  let price=(await stripe.prices.list({lookup_keys:[lookup],active:true,limit:1})).data[0];
  if(!price)price=await stripe.prices.create({currency:'eur',unit_amount:amount,recurring:{interval},lookup_key:lookup,product_data:{name:`TEST ${plan} ${interval}`}}, {idempotencyKey:lookup});
  assert.equal(price.livemode,false);assert.equal(price.unit_amount,amount);
  values[`STRIPE_PRICE_${name}`]=price.id;
}
const variables=Object.entries(values).map(([key,value])=>({key,value,target:['preview'],type:key.startsWith('PUBLIC_')?'encrypted':'sensitive'}));
const {token}=JSON.parse(readFileSync(join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));
assert.ok(token,'Vercel authentication required');
const result=await fetch(`https://api.vercel.com/v10/projects/${project.projectId}/env?teamId=${project.orgId}&upsert=true`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(variables)});
const response=await result.json();
assert.ok(result.ok&&!response.error,`Preview configuration failed (${result.status}; ${response.error?.code??'unknown'})`);
console.log(`Configured ${variables.length} Preview variables`);
console.log('Preview isolated. No production variables changed. No emails or charges.');
