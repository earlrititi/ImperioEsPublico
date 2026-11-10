import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {Socket} from 'node:net';
Socket.prototype.connect=()=>{throw Error('Real network prohibited');};
Object.assign(process.env,{PUBLIC_SITE_URL:'https://imperioes.com',PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',
  RESEND_API_KEY:'re_fixture',RESERVATION_TOKEN_SECRET:'isolated-verification-secret-for-testing',STRIPE_SECRET_KEY:'sk_test_fixture',
  RATE_LIMIT_SECRET:'fixture',MARKETING_CONTACT_VERIFICATION_ENABLED:'true',MARKETING_VERIFICATION_SECRET:'isolated-verification-secret-for-testing',COMMERCE_EMAIL_MODE:'test',COMMERCE_TEST_EMAIL:'sink@example.invalid'});
let row=null,blocked=false,failed=false;const sends=[],consents=[];
const json=(value,status=200)=>Response.json(value,{status});
globalThis.fetch=async(input,options)=>{
  const request=input instanceof Request?input:new Request(input,options),url=new URL(request.url),path=url.pathname;
  const body=request.method==='GET'?null:await request.json();
  if(path==='/rest/v1/rpc/consume_rate_limit')return json(true);
  if(path==='/rest/v1/marketing_suppressed_contacts')return json(blocked?[{email:'reader@example.invalid'}]:[]);
  if(path==='/rest/v1/legal_consents'){assert.equal(body.accepted,true);assert.ok(body.metadata.consent_text.includes('ofertas'));consents.push(body);return json({id:body.anonymous_id});}
  if(path==='/rest/v1/marketing_email_verifications'){
    if(request.method==='POST'){row={...body,verified_at:null};return json(null);}
    if(request.method==='PATCH'){Object.assign(row,body);return json(null);}
    return json(row);
  }
  if(path==='/rest/v1/rpc/confirm_marketing_email'){
    const valid=row&&!blocked&&!row.verified_at&&body.p_id===row.id&&body.p_hash===row.token_hash&&Date.parse(row.expires_at)>Date.now();
    if(valid)row.verified_at=new Date().toISOString();return json(Boolean(valid));
  }
  if(url.hostname==='api.resend.com'&&path==='/emails'){
    assert.equal(body.to,'sink@example.invalid');sends.push({body,key:request.headers.get('idempotency-key')});
    return failed?json({name:'application_error',message:'fixture failure'},500):json({id:'fixture-provider'});
  }
  throw Error(`Unexpected fixture ${request.method} ${path}`);
};
const chunks=new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);
const file=readdirSync(chunks).find(name=>name.startsWith('marketing-contacts_')&&name.endsWith('.mjs'));assert.ok(file);
const exports=await import(new URL(file,chunks));const start=Object.values(exports).flatMap(value=>typeof value==='object'?Object.values(value):[value]).find(fn=>typeof fn==='function'&&fn.name==='requestMarketingVerification');assert.ok(start);
const contact={email:' Reader@Example.invalid ',name:'Lector <prueba>',source:'newsletter_pdf',contextId:'request-1'};
process.env.COMMERCE_EMAIL_MODE='';await start(contact);assert.equal(sends.length,0,'Unconfigured transport fails closed');
process.env.COMMERCE_EMAIL_MODE='test';blocked=true;await start(contact);assert.equal(sends.length,0);blocked=false;
failed=true;await assert.rejects(start(contact));assert.equal(row.verified_at,null);assert.equal(row.email,'reader@example.invalid');
const first=sends.at(-1);failed=false;await start(contact);assert.deepEqual(sends.at(-1),first,'Retry uses exact token, content and provider key');
const sent=sends.length;await start(contact);assert.equal(sends.length,sent,'Accepted confirmation does not resend');
const link=sends.at(-1).body.text.match(/https:\/\/imperioes\.com\/comunicaciones\/confirmar#([^\s]+)/)[1],parts=link.split('.');
const {default:app}=await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
const confirm=(token,origin='https://imperioes.com')=>app.fetch(new Request('https://imperioes.com/api/marketing/confirm',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:parts[0],token})}));
assert.equal((await confirm(parts[1],'https://foreign.invalid')).status,403);
assert.equal((await confirm('0'.repeat(64))).status,400);assert.equal(row.verified_at,null);
assert.equal((await confirm(parts[1])).status,200);assert.ok(row.verified_at);assert.equal((await confirm(parts[1])).status,400,'Capability cannot be replayed');
row.verified_at=null;row.expires_at=new Date(Date.now()-1000).toISOString();
await start({...contact,contextId:'explicit-request-2'});assert.equal(sends.length,sent+1);assert.notEqual(sends.at(-1).key,first.key,'Explicit renewal uses a new token and provider key');
assert.ok(consents.every(c=>c.anonymous_id));
console.log('Compiled opt-in verification: explicit modes, Test recipient, suppression, immutable retry, no account required, CSRF, tampering, replay and explicit renewal passed. No real email or network.');
