import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
const env=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
const base='https://imperioes.com';
assert.equal(env.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
assert.equal(env.RESERVATION_MODE,'true');
const db=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const call=async(path,body,headers={})=>{
 const response=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json',Origin:base}:{}),...headers},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json()};
};
const initial=await call('/api/reservations/inventory');
assert.equal(initial.status,200);assert.equal(initial.data.reservationMode,true);assert.equal(initial.data.unitPrice,2999);
assert.equal((await call('/api/commerce-admin')).status,403);
if(!process.argv.includes('--apply')){console.log('Production inventory and payment mode verified; no reservation created.');process.exit(0);}
const sku='IE-CAMISETA-IMPERIAL-M';assert.ok(initial.data.variants.find(v=>v.sku===sku).available_stock>0);
const {data:proof}=await call('/api/reservations/challenge');assert.ok(proof.challenge);
let nonce=0;while(!createHash('sha256').update(`${proof.challenge}:${nonce}`).digest('hex').startsWith('000'))nonce++;
await new Promise(r=>setTimeout(r,1100));
const customer={name:'Prueba tecnica de despliegue (cancelar)',email:'contacto@imperioes.com',phone:'+34 600000000'};
const address={name:customer.name,line1:'Calle de pruebas 12',line2:'PRUEBA SIN ENVIO',postalCode:'28001',city:'Madrid',province:'28',country:'ES'};
let own;
try{
 const result=await call('/api/reservations',{requestId:proof.challenge.split('.')[0],challenge:proof.challenge,nonce:String(nonce),accepted:true,website:'',customer,address,items:[{sku,quantity:1}],total:1});
 assert.equal(result.status,201,`Reservation creation failed: ${result.data.code}`);
 const [id,token]=new URL(result.data.url).hash.slice(1).split('.');own={id,token};
 writeFileSync('.codex-reservation-release/smoke-reservation.json',JSON.stringify(own),{mode:0o600});
 const view=await call(`/api/reservations/${id}`,{action:'view',token});assert.equal(view.status,200);
 assert.equal(view.data.reservation.status,'RESERVED');assert.equal(view.data.reservation.total_price_snapshot,2999);
 assert.deepEqual(view.data.reservation.shipping_address,address);
 assert.equal(view.data.reservation.customer_phone,null);
 assert.equal(view.data.reservation.marketing_consent,false);
 assert.equal((await call(`/api/reservations/${id}/checkout`,{token,address,confirmPurchase:true})).data.code,'RESERVATION_MODE');
 assert.equal((await call(`/api/reservations/${id}`,{action:'view',token:'a'.repeat(64)})).status,404);
 const attempts=await db.from('reservation_payment_attempts').select('id',{head:true,count:'exact'}).eq('reservation_id',id);assert.ifError(attempts.error);assert.equal(attempts.count,0);
}finally{
 if(own){const result=await call(`/api/reservations/${own.id}`,{action:'cancel',token:own.token});assert.equal(result.status,200);assert.equal(result.data.reservation.status,'CANCELLED');}
}
const restored=await call('/api/reservations/inventory');
// Concurrent real visitors may reserve stock; verify this reservation's release from DB instead of overwriting totals.
const {data:r,error}=await db.from('reservations').select('status,total_price_snapshot').eq('id',own.id).single();assert.ifError(error);assert.equal(r.status,'CANCELLED');
await call('/api/commerce-maintenance',{}, {Authorization:`Bearer ${env.COMMERCE_JOB_SECRET}`});
const jobs=await db.from('commerce_outbox').select('kind,status,provider_id').eq('reservation_id',own.id);assert.ifError(jobs.error);
assert.ok(jobs.data.every(j=>j.status==='SENT'));
const resend=new Resend(env.RESEND_API_KEY),deliveries=[];
for(const job of jobs.data){
 const result=await resend.emails.get(job.provider_id);assert.ifError(result.error);
 assert.ok(result.data.from.includes('contacto@imperioes.com'));assert.ok(result.data.to.includes('contacto@imperioes.com'));
 deliveries.push({kind:job.kind,event:result.data.last_event,id:job.provider_id});
 await new Promise(r=>setTimeout(r,600));
}
const report={site:base,reservationNumber:own.id,reservationCancelled:true,totalCents:2999,paymentAttempts:0,inventory:restored.data.variants,mail:deliveries};
writeFileSync('.codex-reservation-release/smoke-result.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
