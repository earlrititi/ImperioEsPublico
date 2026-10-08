import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import Stripe from 'stripe';
const env=parseEnv(readFileSync('.env.reservation-test.local','utf8'));
assert.equal(env.SUPABASE_TEST_PROJECT_REF,'joicpkgvggfxzrdazisx');
assert.match(env.STRIPE_SECRET_KEY,/^(sk|rk)_test_/);
const stripe=new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id,'acct_1UCc4cDRITvLIOKF');
const price=await stripe.prices.retrieve(env.STRIPE_PRICE_CAMISETA_IMPERIAL);
assert.equal(price.unit_amount,2699);assert.equal(price.livemode,false);
const tax=await stripe.taxRates.retrieve(env.STRIPE_ES_VAT_RATE_ID);
assert.equal(tax.inclusive,true);assert.equal(tax.percentage,21);assert.equal(tax.livemode,false);
const product=typeof price.product==='string'?price.product:price.product.id;
const output=join(mkdtempSync(join(tmpdir(),'imperio-shirt-discounts-')),'lines.cjs');
const results=[];
try {
  await build({entryPoints:['src/lib/shirt-checkout-lines.ts'],outfile:output,platform:'node',format:'cjs',bundle:true,logLevel:'silent'});
  const {shirtCheckoutLines}=createRequire(import.meta.url)(output);
  for(const percent of [0,15,20]) {
    let coupon;
    if(percent) {
      const id=`imperio-test-shirt-only-${percent}-v1`;
      try {coupon=await stripe.coupons.retrieve(id,{expand:['applies_to']});}
      catch(error) {if(error.code!=='resource_missing') throw error;coupon=await stripe.coupons.create({id,percent_off:percent,duration:'once',applies_to:{products:[product]},expand:['applies_to']},{idempotencyKey:id});}
      assert.deepEqual(coupon.applies_to.products,[product]);
    }
    for(const quantity of [1,3]) {
      const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],
        line_items:shirtCheckoutLines(price.id,tax.id,[{quantity}]),discounts:coupon?[{coupon:coupon.id}]:undefined,
        success_url:'https://imperioes.com/compra/completada',cancel_url:'https://imperioes.com/tienda',
        metadata:{purpose:'shirt-discount-test'}});
      try {
        assert.equal(session.livemode,false);assert.equal(session.payment_status,'unpaid');
        const discount=Math.round(2699*quantity*percent/100);
        assert.equal(session.total_details.amount_discount,discount);
        assert.equal(session.amount_total,2999*quantity-discount);
        const lines=(await stripe.checkout.sessions.listLineItems(session.id)).data;
        const postage=lines.find(line=>line.price.unit_amount===300);
        assert.equal(postage.quantity,quantity);assert.equal(postage.amount_discount,0);
        assert.equal(postage.amount_total,300*quantity);
        results.push({quantity,percent,totalCents:session.amount_total,shippingCents:postage.amount_total});
      } finally {await stripe.checkout.sessions.expire(session.id);}
    }
  }
  console.log(JSON.stringify({passed:true,mode:'test',charges:0,results}));
} finally {rmSync(output,{force:true});}
