import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseEnv} from 'node:util';import Stripe from 'stripe';
const e=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
const pulled=parseEnv(readFileSync('.env.admin-production.local','utf8'));
e.STRIPE_ES_VAT_RATE_ID=pulled.STRIPE_ES_VAT_RATE_ID;
assert.match(e.STRIPE_SECRET_KEY,/^(sk|rk)_live_/);
const stripe=new Stripe(e.STRIPE_SECRET_KEY);const account=await stripe.accounts.retrieve();
assert.equal(account.id,'acct_1UCc4cDRITvLIOKF');assert.ok(account.charges_enabled && account.payouts_enabled);
const tax=await stripe.taxRates.retrieve(e.STRIPE_ES_VAT_RATE_ID);assert.ok(tax.active&&tax.livemode&&tax.inclusive);assert.equal(tax.percentage,21);
const endpoints=await stripe.webhookEndpoints.list({limit:100});
assert.ok(endpoints.data.some(w=>w.livemode&&w.status==='enabled'&&w.url==='https://imperioes.com/api/stripe-webhook'&&w.enabled_events.includes('checkout.session.completed')&&w.enabled_events.includes('invoice.paid')));
const sessions=[];
try{
  for(const [name,amount] of [['ARCABUCERO_MONTHLY',199],['ARCABUCERO_ANNUAL',1799],['MAESTRE_CAMPO_MONTHLY',399],['MAESTRE_CAMPO_ANNUAL',3799],['CAMISETA_IMPERIAL',2699]]){
    const price=await stripe.prices.retrieve(e['STRIPE_PRICE_'+name]);assert.ok(price.active&&price.livemode);assert.equal(price.currency,'eur');assert.equal(price.unit_amount,amount);
    if(!process.argv.includes('--sessions'))continue;
    const shirt=name==='CAMISETA_IMPERIAL';
    const session=await stripe.checkout.sessions.create({mode:shirt?'payment':'subscription',payment_method_types:['card'],locale:'es',
      customer_email:'readiness-check@example.invalid',billing_address_collection:'required',metadata:{readiness_check:'no_payment'},
      line_items:shirt?[{price:price.id,quantity:1,tax_rates:[tax.id]},{price_data:{currency:'eur',unit_amount:300,tax_behavior:'inclusive',product_data:{name:'Envio peninsular por unidad'}},quantity:1,tax_rates:[tax.id]}]:[{price:price.id,quantity:1}],
      ...(shirt?{}:{subscription_data:{default_tax_rates:[tax.id]}}),success_url:'https://imperioes.com/gracias',cancel_url:'https://imperioes.com/tienda'});
    sessions.push(session.id);assert.ok(session.livemode&&session.url);assert.equal(session.status,'open');assert.equal(session.payment_status,'unpaid');
    if(shirt)assert.equal(session.amount_total,2999);
  }
  console.log('Live account, card payments, webhook, five prices and inclusive VAT verified. '+sessions.length+' unpaid Checkout sessions created for validation.');
}finally{
  for(const id of sessions){const session=await stripe.checkout.sessions.expire(id);assert.equal(session.status,'expired');}
  console.log('Validation sessions expired. No charges or subscriptions created.');
}
process.exit(0);
