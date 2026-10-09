import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
const e=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(e.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
const db=createClient(e.PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const origin='https://imperioes.com';
const inventory=await fetch(origin+'/api/reservations/inventory',{cache:'no-store'});
assert.equal(inventory.status,200);
const data=await inventory.json();
assert.equal(data.salesEnabled,true);assert.equal(data.reservationMode,false);
assert.equal(data.unitPrice,2999);assert.equal(data.campaign.purchase_activated,true);
for(const path of ['/','/instagram','/tienda','/reservas','/suscribirse','/papeles-y-tratados','/legal/terminos','/checkout/arcabucero-monthly','/checkout/arcabucero-annual','/checkout/maestre-campo-monthly','/checkout/maestre-campo-annual']){
  const r=await fetch(origin+path);assert.equal(r.status,200,path);
  const html=await r.text();assert.doesNotMatch(html,/sk_live_|service_role/);
  assert.doesNotMatch(html,/se habilita el 12 de octubre de 2026/);
  if(path==='/instagram'){assert.match(html,/COMPRAR CAMISETA/);assert.doesNotMatch(html,/data-reserve aria-disabled="true"/);}
  if(path.startsWith('/checkout/'))assert.doesNotMatch(html,/<button[^>]*type="submit"[^>]*disabled/);
}
for(const api of ['overview','articles','subscriptions','analytics','mail','newsletter','funnel']){
  const r=await fetch(origin+'/api/admin/'+api);assert.equal(r.status,403,api);
  assert.match(r.headers.get('cache-control'),/no-store/);
}
assert.equal((await fetch('https://www.imperioes.com')).status,200);
const manifesto=await fetch(origin+'/manifiesto');assert.equal(manifesto.status,200);
assert.match(await manifesto.text(),/id="manifesto-marketing"/);
for(const path of ['/admin/embudo','/admin/newsletter']){
 const r=await fetch(origin+path,{redirect:'manual'});assert.ok([302,303].includes(r.status));assert.match(r.headers.get('location'),/^\/login/);
}
const notices=await db.from('admin_notification_history').select('kind');assert.ifError(notices.error);
const historical=await db.from('subscriptions').select('status').in('id',['21db5a74-fe58-44fe-9efe-9dc3b9fb5c80','de100145-cc41-438c-a235-51524adf6c07','c7ebb831-ca3a-4308-90d1-f5ef2fa222d9']);assert.ifError(historical.error);
assert.equal(historical.data.length,3);assert.ok(historical.data.every(r=>r.status==='legacy_unverified'));
console.log(JSON.stringify({liveSales:true,priceCents:2999,notices:notices.data.length,historicalArchived:3,privateApisProtected:true}));
if(process.argv.includes('--maintenance')){
  const queued=await db.from('email_logs').select('id',{head:true,count:'exact'}).in('status',['pending','processing','failed']);assert.ifError(queued.error);assert.equal(queued.count,0,'Refuse to dispatch unrelated queued admin mail');
  const r=await fetch(origin+'/api/commerce-maintenance',{method:'POST',headers:{Authorization:`Bearer ${e.COMMERCE_JOB_SECRET}`,'Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,200);console.log('Commerce maintenance:',JSON.stringify(await r.json()));
}
await db.auth.stopAutoRefresh();
process.exit(0);
