import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from '../src/config/products';
import assert from 'node:assert/strict';
const env=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
assert.equal(env.RESERVATION_MODE,'true');
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);
const db=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const shirt=PRODUCTS['camiseta-imperial'];
const check=(error:unknown)=>{if(error)throw new Error('Production catalog operation failed');};
let {data:product,error}=await db.from('products').select('id').eq('slug',shirt.slug).maybeSingle();check(error);
if(!product){
 const result=await db.from('products').insert({slug:shirt.slug,name:shirt.name,description:shirt.baseGarmentModel,sku:shirt.sku,currency:'eur',stock:null,
 manufacturer_name:shirt.manufacturer,manufacturer_email:shirt.manufacturerEmail,manufacturer_address:shirt.manufacturerAddress,
 shipping_information:shirt.shippingInformation,legal_status:shirt.legalStatus,status:'draft'}).select('id').single();check(result.error);product=result.data;
}
assert.ok(product);
for(const v of shirt.variantDetails){
 const sku=`${shirt.sku}-${v.size}`;
 const existing=await db.from('product_variants').select('id').eq('sku',sku).maybeSingle();check(existing.error);
 if(!existing.data)check((await db.from('product_variants').insert({product_id:product.id,name:v.size,sku,physical_stock:v.stock,color:shirt.color})).error);
}
const prices=await db.from('product_prices').select('amount').eq('product_id',product.id).is('ends_at',null);check(prices.error);
if(prices.data?.length)assert.ok(prices.data.every(p=>p.amount===shirt.expectedUnitAmount),'Existing price requires manual review, not overwrite');
else check((await db.from('product_prices').insert({product_id:product.id,amount:shirt.expectedUnitAmount,currency:'eur',starts_at:new Date().toISOString()})).error);
const inventory=await db.from('product_variants').select('name,physical_stock,reserved_stock,sold_stock,available_stock').eq('product_id',product.id).order('name');check(inventory.error);
console.log(JSON.stringify({productionCatalog:true,existingStockNeverOverwritten:true,inventory:inventory.data,unitPrice:shirt.expectedUnitAmount}));
