import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { Socket } from 'node:net';
import { AUTOMATION_DEFAULTS } from '../src/lib/email-automations.ts';

Socket.prototype.connect = () => { throw Error('No external network in suppression fixture'); };
Object.assign(process.env, {
  COMMERCE_EMAIL_MODE: 'live', STRIPE_SECRET_KEY: 'sk_live_fixture', RESEND_API_KEY: 're_fixture',
  MARKETING_AUTOMATIONS_ENABLED: 'true', MARKETING_AUTOMATION_SCOPE: 'recovery_welcome',
  RESEND_WEBHOOK_SECRET: 'fixture-svix-secret', PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture',
});
const id = '11111111-1111-4111-8111-111111111111', recipient = 'reader@example.invalid';
const runtime = {
  id:true, enabled:true, approved_by:id, approved_at:new Date(Date.now()-3600000).toISOString(),
  enrollment_starts_at:new Date(Date.now()-7200000).toISOString(), purchase_proof_id:id,
  template_digest:createHash('sha256').update(JSON.stringify(AUTOMATION_DEFAULTS.filter(item=>['welcome','checkout','cart'].includes(item.key)))).digest('hex'),
};
const writes = [], rpcReasons = [];
let failSuppression = false, providerEvent = 'suppressed';
globalThis.fetch = async (input, init) => {
  const request=input instanceof Request?input:new Request(input,init),url=new URL(request.url),path=url.pathname;
  const body=request.method==='GET'?null:await request.json();
  if(url.hostname==='api.resend.com') {
    assert.equal(request.method,'GET');
    return Response.json({id:'provider_fixture',to:[recipient],last_event:providerEvent});
  }
  if(path==='/rest/v1/marketing_automation_runtime')return Response.json(runtime);
  if(path==='/rest/v1/marketing_automation_drafts')return Response.json([]);
  if(path==='/rest/v1/commerce_orders')return Response.json({stripe_checkout_session_id:'cs_live_fixture',total:2699,status:'READY_FOR_FULFILLMENT'});
  if(path==='/rest/v1/marketing_automation_jobs'&&request.method==='GET')return Response.json([{id,user_id:id,provider_id:'provider_fixture'}]);
  if(path==='/rest/v1/email_logs'&&request.method==='GET')return Response.json([{id,recipient,provider_message_id:'provider_fixture'}]);
  if(path==='/rest/v1/email_suppressions') {
    writes.push({body,preference:request.headers.get('prefer')});
    assert.equal(body.email,recipient); assert.equal(body.reason,'provider_suppressed');
    assert.equal(url.searchParams.get('on_conflict'),'email');
    assert.match(request.headers.get('prefer'),/resolution=ignore-duplicates/);
    return failSuppression?Response.json({message:'fixture failure'},{status:503}):Response.json([]);
  }
  if(path==='/rest/v1/rpc/suppress_marketing_email') { rpcReasons.push(body.p_reason);return Response.json(null); }
  if(['/rest/v1/email_provider_events','/rest/v1/customer_mail_deliveries','/rest/v1/marketing_automation_jobs','/rest/v1/email_logs',
    '/rest/v1/paid_order_admin_outbox','/rest/v1/seo_jobs','/rest/v1/post_delivery_jobs'].includes(path))return Response.json([]);
  throw Error(`Unexpected suppression fixture ${request.method} ${path}`);
};
const directory=new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);
async function compiledFunction(prefix,name) {
  for(const file of readdirSync(directory).filter(file=>file.startsWith(prefix)&&file.endsWith('.mjs'))) {
    const module=await import(new URL(file,directory).href);
    const fn=Object.values(module).find(value=>typeof value==='function'&&value.name===name);
    if(fn)return fn;
  }
  throw Error(`Missing compiled function ${name}`);
}
const automate=await compiledFunction('automation-worker_','automationDeliveryReceipts');
const admin=await compiledFunction('admin-mail_','reconcileAdminDelivery');
assert.equal((await automate(1)).checked,1);
assert.equal(writes.length,1);
assert.equal((await admin(1)).checked,1);
assert.equal(writes.length,2);
process.env.COMMERCE_EMAIL_MODE='test';process.env.STRIPE_SECRET_KEY='sk_test_fixture';
await admin(1);assert.equal(writes.length,2); // The redirected test message cannot suppress the customer.
process.env.COMMERCE_EMAIL_MODE='live';process.env.STRIPE_SECRET_KEY='sk_live_fixture';
providerEvent='complained';await admin(1);assert.deepEqual(rpcReasons,['provider_complained']);
providerEvent='suppressed';
const {default:app}=await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
function webhook(valid=true) {
  const body=JSON.stringify({type:'email.suppressed',data:{email_id:'provider_fixture',to:[recipient]}});
  const timestamp=String(Math.floor(Date.now()/1000)),event='suppression_fixture';
  const signature=createHmac('sha256',process.env.RESEND_WEBHOOK_SECRET).update(`${event}.${timestamp}.${body}`).digest('base64');
  return new Request('https://imperioes.com/api/resend-webhook',{method:'POST',body,headers:{
    'Content-Type':'application/json','svix-id':event,'svix-timestamp':timestamp,'svix-signature':valid?`v1,${signature}`:'v1,invalid',
  }});
}
assert.equal((await app.fetch(webhook(false))).status,400);assert.equal(writes.length,2);
assert.equal((await app.fetch(webhook())).status,200);assert.equal(writes.length,3);
failSuppression=true;
assert.equal((await app.fetch(webhook())).status,503);assert.equal(writes.length,4);
console.log('Provider suppression: both receipt pollers, live/test separation, preserved complaint RPC, verified webhook and retry on storage failure passed. No real network or emails.');
