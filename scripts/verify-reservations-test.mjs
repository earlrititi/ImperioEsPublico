import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env=parseEnv(readFileSync('.env.reservation-test.local','utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL,'https://joicpkgvggfxzrdazisx.supabase.co');
const db=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const base='http://127.0.0.1:4323';let checks=0;
const call=async(path,body)=>{const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json',Origin:base}:undefined,body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};};
const proof=async()=>{const {data}=await call('/api/reservations/challenge');assert.ok(data.challenge);let nonce=0;while(!createHash('sha256').update(`${data.challenge}:${nonce}`).digest('hex').startsWith('000'))nonce++;return {challenge:data.challenge,nonce:String(nonce),requestId:data.challenge.split('.')[0]};};
const customer={name:'Cliente de prueba automatizada',email:'reservation-test@example.invalid',phone:'+34 600000000'};
const address={name:customer.name,line1:'Calle de pruebas 12',line2:'',postalCode:'28001',city:'Madrid',province:'28',country:'ES'};
const credentials=(url)=>{const [id,token]=new URL(url).hash.slice(1).split('.');return{id,token};};
const created=[];
try {
  const initial=await call('/api/reservations/inventory');assert.equal(initial.status,200);assert.equal(initial.data.unitPrice,2999);checks++;
  const sku='IE-CAMISETA-IMPERIAL-S';const stock=initial.data.variants.find(v=>v.sku===sku).available_stock;assert.ok(stock>0);
  const a=await proof();const b=await proof();await new Promise(r=>setTimeout(r,1100));
  const body=p=>({...p,customer,address,accepted:true,website:'',items:[{sku,quantity:stock}],price:1,total:1,shippingCost:9900});
  const pair=await Promise.all([call('/api/reservations',body(a)),call('/api/reservations',body(b))]);
  const success=pair.find(r=>r.status===201);const failure=pair.find(r=>r.status!==201);
  assert.ok(success,JSON.stringify(pair.map(r=>({status:r.status,code:r.data.code}))));created.push(credentials(success.data.url));
  assert.equal(failure?.data.code,'OUT_OF_STOCK');checks++;
  const own=created[0];const view=await call(`/api/reservations/${own.id}`,{action:'view',token:own.token});assert.equal(view.status,200);
  assert.equal(view.data.reservation.total_price_snapshot,stock*2999);assert.equal(view.data.reservation.reservation_items[0].unit_price_snapshot,2999);checks++;
  const retry=await call('/api/reservations',body(pair[0].status===201?a:b));assert.equal(retry.data.id,own.id);checks++;
  const hidden=await call(`/api/reservations/${own.id}`,{action:'view',token:'a'.repeat(64)});assert.equal(hidden.status,404);checks++;
  const noPay=await call(`/api/reservations/${own.id}/checkout`,{token:own.token,address,confirmPurchase:true});assert.equal(noPay.data.code,'RESERVATION_MODE');checks++;
  const unavailable=await call('/api/reservations/inventory');assert.equal(unavailable.data.variants.find(v=>v.sku===sku).available_stock,0);checks++;
  const admin=await call('/api/commerce-admin');assert.equal(admin.status,403);checks++;
  const anon=createClient(env.PUBLIC_SUPABASE_URL,env.PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const denied=await anon.from('reservations').select('*');assert.ok(denied.error||!denied.data?.length);checks++;
  const deniedRPC=await anon.rpc('release_shirt_reservation',{p_id:own.id,p_status:'CANCELLED'});assert.ok(deniedRPC.error);checks++;
  for(let i=0;i<2;i++)assert.equal((await call(`/api/reservations/${own.id}`,{action:'cancel',token:own.token})).status,200);
  const restored=await call('/api/reservations/inventory');assert.equal(restored.data.variants.find(v=>v.sku===sku).available_stock,stock);checks++;
  const outbox=await db.from('commerce_outbox').select('kind,status').eq('reservation_id',own.id);assert.ifError(outbox.error);assert.deepEqual(outbox.data.map(j=>j.kind).sort(),['CANCELLED','RESERVED']);checks++;
  const invalid=await call('/api/reservations',{...body(b),address:{...address,province:'07',postalCode:'07001'}});assert.notEqual(invalid.status,201);checks++;
  const honeypot=await call('/api/reservations',{...body(b),website:'bot.example'});assert.equal(honeypot.data.code,'ANTI_BOT');checks++;
  console.log(`${checks} HTTP/Supabase Test checks passed: concurrent stock, idempotency, totals, cancellation, private access and payment blockade. No payments or real customer email.`);
} finally {
  for(const own of created)await call(`/api/reservations/${own.id}`,{action:'cancel',token:own.token}).catch(()=>{});
}
