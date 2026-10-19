import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import Stripe from "stripe";

const { values } = parseArgs({options:{mode:{type:"string",default:"test"},apply:{type:"boolean",default:false}}});
assert.ok(["test","live"].includes(values.mode));
const env = parseEnv(readFileSync(values.mode === "test" ? ".env.reservation-test.local" : ".env.reservation-production.local","utf8"));
assert.ok(new RegExp(`^(sk|rk)_${values.mode}_`).test(env.STRIPE_SECRET_KEY ?? ""),"Stripe mode mismatch");
if(values.mode === "live" && values.apply) assert.equal(process.env.COMMERCE_LIVE_COPY_APPROVED,"true","Explicit Live copy approval required");
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id,"acct_1UCc4cDRITvLIOKF");
const price = await stripe.prices.retrieve(env.STRIPE_PRICE_CAMISETA_IMPERIAL,{expand:["product"]});
assert.equal(price.currency,"eur");assert.equal(price.unit_amount,2699);assert.equal(price.livemode,values.mode === "live");
const product = price.product;
assert.ok(typeof product === "object" && !product.deleted && product.active);
assert.equal(product.livemode,values.mode === "live");
const copy = {name:"Camiseta Imperial",description:"IVA incluido. Envio Correos a Espana peninsular: 3 EUR por unidad, desglosado por separado."};
const needsChange = product.name !== copy.name || product.description !== copy.description;
if(values.apply && needsChange) {
  const updated = await stripe.products.update(product.id,copy);
  assert.equal(updated.name,copy.name);assert.equal(updated.description,copy.description);
}
console.log(JSON.stringify({mode:values.mode,applied:values.apply && needsChange,needsChange,previous:{name:product.name,description:product.description},proposed:copy,pricesChanged:false,couponProductsChanged:false},null,2));
