import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {Socket} from 'node:net';
import {randomUUID} from 'node:crypto';
Socket.prototype.connect=()=>{throw Error('Real network prohibited');};
Object.assign(process.env,{PUBLIC_SITE_URL:'https://imperioes.com',PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',RESEND_API_KEY:'fixture',RESERVATION_TOKEN_SECRET:'fixture',RATE_LIMIT_SECRET:'fixture',COMMERCE_EMAIL_MODE:'test',COMMERCE_TEST_EMAIL:'sink@example.invalid'});
const rows=new Map(),consents=[],sends=[];let fail=false,noticeFailed=false;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(input,options)=>{
 const r=input instanceof Request?input:new Request(input,options);const u=new URL(r.url);const body=r.method==='GET'?null:await r.json();
 if(u.pathname==='/rest/v1/rpc/consume_rate_limit')return json(true);
 if(u.pathname==='/rest/v1/manifesto_requests'){
  const id=u.searchParams.get('id')?.slice(3);
  if(r.method==='POST'){if(!rows.has(body.id))rows.set(body.id,{...body,status:'pending'});return json(null);}
  if(r.method==='PATCH'){Object.assign(rows.get(id),body);return json(null);}
  return json(rows.get(id));
 }
 if(u.pathname==='/rest/v1/legal_consents'){consents.push(...body);return json(null);}
 if(u.pathname==='/rest/v1/rpc/claim_stripe_event')return json(true);
 if(u.pathname==='/rest/v1/stripe_webhook_events')return json(null);
 if(u.pathname==='/rest/v1/admin_notification_history')return json(null);
 if(u.hostname==='api.resend.com'&&u.pathname==='/emails'){
  sends.push(body);if(fail||noticeFailed&&body.subject!=='Tu manifiesto de Imperio Espanol')return json({name:'application_error',message:'Fixture failure'},500);
  return json({id:'provider_fixture'});
 }
 throw Error(`Unexpected fixture ${r.method} ${u.pathname}`);
};
const dir=new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);
const file=readdirSync(dir).find(n=>n.startsWith('manifesto_')&&n.endsWith('.mjs'));assert.ok(file);
const {page:load}=await import(new URL(file,dir));const page=load();
const payload={firstName:'Test',email:'test@example.invalid',anonymousId:randomUUID(),requestId:randomUUID(),privacyAcknowledged:true,source:'fixture'};
const post=body=>page.POST({request:new Request('https://imperioes.com/api/manifesto.php',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://imperioes.com'},body:JSON.stringify(body)})});
assert.equal((await post(payload)).status,200);assert.equal(rows.get(payload.requestId).status,'accepted');
assert.equal(rows.get(payload.requestId).name,'Test');assert.ok(sends.find(s=>s.subject==='Tu manifiesto de Imperio Espanol').text.startsWith('Hola Test,'));
assert.equal(consents.length,1);assert.equal(consents[0].context_id,payload.requestId);assert.equal(consents[0].consent_type,'privacy_acknowledgement');
assert.ok(sends.every(s=>s.to.includes('sink@example.invalid')));
const resources=()=>sends.filter(s=>s.subject==='Tu manifiesto de Imperio Espanol').length;
assert.equal((await post(payload)).status,200);assert.equal(resources(),1,'Accepted request never resends resource');
assert.equal((await post({...payload,email:'different@example.invalid'})).status,409);
const marketing={...payload,requestId:randomUUID(),marketingConsent:true};fail=true;
assert.equal((await post(marketing)).status,502);assert.equal(rows.get(marketing.requestId).status,'failed');
assert.ok(consents.some(c=>c.context_id===marketing.requestId&&c.consent_type==='marketing_email'));
fail=false;noticeFailed=true;assert.equal((await post(marketing)).status,500);assert.equal(rows.get(marketing.requestId).status,'accepted');
const count=resources();noticeFailed=false;assert.equal((await post(marketing)).status,200);assert.equal(resources(),count,'Owner-notice retry cannot resend the resource');
assert.equal((await post({...payload,requestId:randomUUID(),firstName:'   '})).status,400,'Manifesto still requires a name');
const legacy={...payload,requestId:randomUUID(),lastName:'Optional'};
assert.equal((await post(legacy)).status,200);assert.equal(rows.get(legacy.requestId).name,'Test Optional','Cached older forms remain compatible');
const news={email:'newsletter@example.invalid',requestId:randomUUID(),anonymousId:randomUUID(),resource:'seven_stories',consentAction:'newsletter_pdf',privacyAcknowledged:true,marketingConsent:true};
assert.equal((await post({...news,marketingConsent:false})).status,400);
assert.equal((await post({...news,consentAction:'download'})).status,400);
assert.equal((await post({...news,resource:'untrusted'})).status,400);
assert.equal((await post(news)).status,200);assert.equal(rows.get(news.requestId).resource,'seven_stories');
const proof=consents.find(c=>c.context_id===news.requestId&&c.consent_type==='marketing_email');assert.equal(proof.source,'newsletter_pdf');assert.ok(proof.metadata.consent_text.includes('ofertas'));assert.equal(proof.metadata.action,'Suscribirme y recibir el PDF');
const pdf=sends.find(s=>s.subject==='Tus 7 historias del Siglo de Oro');assert.ok(pdf.attachments[0].path.endsWith('/recursos/7-historias-del-siglo-de-oro.pdf'));assert.ok(pdf.text.includes('/comunicaciones/baja?token='));
const native=new URLSearchParams({email:'native@example.invalid',requestId:randomUUID(),anonymousId:randomUUID(),intent:'newsletter_pdf'});
const nativeResult=await page.POST({request:new Request('https://imperioes.com/api/manifesto.php',{method:'POST',headers:{Origin:'https://imperioes.com'},body:native})});
assert.equal(nativeResult.status,303);assert.equal(nativeResult.headers.get('location'),'/newsletter?sent=1');
assert.equal((await post({...payload,requestId:randomUUID(),email:'a'.repeat(260)+'@example.invalid'})).status,400);
process.env.COMMERCE_EMAIL_MODE='disabled';const before=sends.length;
assert.equal((await post({...payload,requestId:randomUUID()})).status,503);assert.equal(sends.length,before);
console.log('Manifesto resource/marketing separation, immutable requests, provider failure, owner retry and Test isolation passed. No real email.');
