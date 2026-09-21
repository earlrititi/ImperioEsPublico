import Stripe from 'stripe';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const file='.env.reservation-test.local',env=parseEnv(readFileSync(file,'utf8'));
if(env.SUPABASE_TEST_PROJECT_REF!=='joicpkgvggfxzrdazisx'||!/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY??''))throw new Error('Only the isolated Test environment is supported');
const stripe=new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:'2026-07-29.dahlia'});
const apply=process.argv.includes('--apply');
try {
  const account=await stripe.accounts.retrieve();
  if(account.id!=='acct_1UCc4cDRITvLIOKF')throw new Error('Unexpected Stripe account');
  let price=(await stripe.prices.list({lookup_keys:['imperio_shirt_final_2999_v1'],active:true,limit:10})).data[0];
  let tax;
  for await(const rate of stripe.taxRates.list({active:true,inclusive:true,limit:100})){if(!rate.livemode&&rate.country==='ES'&&rate.percentage===21){tax=rate;break;}}
  if(apply&&!price){
    let product;
    for await(const p of stripe.products.list({active:true,limit:100})){if(p.name==='Camiseta Imperial'){product=p;break;}}
    product??=await stripe.products.create({name:'Camiseta Imperial',description:'IVA incluido. Envio estandar a Espana peninsular incluido.'},{idempotencyKey:'imperio-test-shirt-product-v1'});
    price=await stripe.prices.create({product:product.id,currency:'eur',unit_amount:2999,tax_behavior:'inclusive',lookup_key:'imperio_shirt_final_2999_v1'},{idempotencyKey:'imperio-test-shirt-final-2999-v1'});
  }
  if(apply&&!tax)tax=await stripe.taxRates.create({display_name:'IVA',description:'IVA Espana 21%',percentage:21,inclusive:true,country:'ES'},{idempotencyKey:'imperio-test-vat-21-inclusive-v1'});
  if(price&&(price.livemode||price.unit_amount!==2999||price.currency!=='eur'||price.type!=='one_time'||price.tax_behavior!=='inclusive'))throw new Error('Existing lookup Price is incompatible');
  if(apply&&price&&tax){env.STRIPE_PRICE_CAMISETA_IMPERIAL=price.id;env.STRIPE_ES_VAT_RATE_ID=tax.id;writeFileSync(file,Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});}
  console.log(JSON.stringify({account:account.id,mode:'test',apply,priceReady:!!price,taxReady:!!tax,reservationModeUnchanged:true,webhookStillRequiresTestForwarding:true}));
}catch(error){console.error(JSON.stringify({configured:false,code:error.code??'TEST_SETUP_FAILED',productionChanged:false}));process.exitCode=1;}
