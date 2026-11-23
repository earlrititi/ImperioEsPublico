import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { Socket } from 'node:net';
Socket.prototype.connect=()=>{throw Error('No real network in service-mail fixture');};
Object.assign(process.env,{PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',PUBLIC_SITE_URL:'https://imperioes.com',COMMERCE_EMAIL_MODE:'live',RESEND_API_KEY:'re_fixture',RESERVATION_TOKEN_SECRET:'fixture'});
let job,blockedReason='unsubscribe',sent=0;
globalThis.fetch=async(input,init)=>{
 const req=input instanceof Request?input:new Request(input,init),url=new URL(req.url),path=url.pathname;
 const body=req.method==='GET'?null:await req.json();
 if(path==='/rest/v1/rpc/claim_admin_mail')return Response.json(job?.status==='pending'?[{...job,status:'processing'}]:[]);
 if(path==='/rest/v1/rpc/finish_admin_mail'){job.status=body.p_status;return Response.json(null);}
 if(path==='/rest/v1/email_suppressions')return Response.json([{reason:blockedReason}]);
 if(path==='/rest/v1/email_logs'){Object.assign(job,body);return Response.json([{id:job.id}]);}
 if(path==='/rest/v1/customer_mail_deliveries')return Response.json([]);
 if(url.hostname==='api.resend.com'&&path==='/emails'){
  assert.equal(body.to,'support@example.invalid');assert.doesNotMatch(body.text,/comunicaciones\/baja/);
  sent++;return Response.json({id:'provider_service_fixture'});
 }
 throw Error(`Unexpected service fixture ${path}: commercial eligibility must not block a service response`);
};
const dir=new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);
const file=readdirSync(dir).find(name=>name.startsWith('admin-mail_')&&name.endsWith('.mjs'));assert.ok(file);
const module=await import(new URL(file,dir)),drain=Object.values(module).find(fn=>typeof fn==='function'&&fn.name==='drainAdminMail');assert.ok(drain);
const reset=()=>{job={id:'11111111-1111-4111-8111-111111111111',claim_id:'22222222-2222-4222-8222-222222222222',recipient:'support@example.invalid',type:'individual',purpose:'service',subject:'Tu consulta de soporte',content:'Respuesta solicitada sobre tu pedido.',preheader:'',cta_label:'',cta_url:'',status:'pending'};sent=0;};
reset();let result=await drain(1);assert.equal(result.sent,1);assert.equal(sent,1);assert.equal(job.status,'sent');
reset();blockedReason='provider_bounced';result=await drain(1);assert.equal(result.sent,0);assert.equal(sent,0);assert.equal(job.status,'review');
console.log('PASS one-to-one service bypasses commercial unsubscribe/frequency, honors hard delivery blocks, and uses the corporate transport; no real email.');
