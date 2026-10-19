import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import { AUTOMATION_DEFAULTS } from '../src/lib/email-automations.ts';
import { LEGAL_DOCUMENT_VERSIONS } from '../src/config/legal.ts';
Socket.prototype.connect = () => { throw Error('No real transport in automation worker fixtures'); };
const id = '11111111-1111-4111-8111-111111111111', now = Date.now(), ago = hours => new Date(now-hours*3600000).toISOString();
Object.assign(process.env, { MARKETING_AUTOMATIONS_ENABLED: 'true', MARKETING_AUTOMATION_CAPTURE_ENABLED: 'false',
  COMMERCE_EMAIL_MODE: 'test', COMMERCE_TEST_EMAIL: 'sink@example.invalid', STRIPE_SECRET_KEY: 'sk_test_fixture',
  RESEND_API_KEY: 're_fixture', RESERVATION_TOKEN_SECRET: 'fixture', PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture' });
const runtime = { enabled: true, approved_by: id, approved_at: ago(1), enrollment_starts_at: ago(72), purchase_proof_id: id, last_user_id: null,
  template_digest: createHash('sha256').update(JSON.stringify(AUTOMATION_DEFAULTS.filter(item=>item.key!=='placed_order'))).digest('hex') };
const baseline = { user_id: id, email: 'verified@example.invalid', name: 'Lector de prueba', consent_id: id,
  marketing_accepted_at: ago(48), welcome_at: null, visited_at: ago(20), product_at: ago(20), cart_at: ago(6), checkout_at: null,
  analytics_accepted: true, analytics_version: LEGAL_DOCUMENT_VERSIONS.cookies, analytics_at: ago(48), analytics_withdrawn_at: null,
  paid_at: null, billing_record: false, payment_in_progress: false };
let subject = structuredClone(baseline), job = null, providerFailure = false, receiptFailure = false, withdrawBeforeSend = false, subjectReads = 0, emails = 0;
const sends = [], saved = [];
const json = (value, status=200) => Response.json(value,{status});
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input,init), url = new URL(req.url), path = url.pathname;
  const body = req.method === 'GET' ? null : await req.json();
  if (path === '/rest/v1/marketing_automation_runtime') return json(req.method==='GET'?runtime:[]);
  if (path === '/rest/v1/marketing_automation_drafts') return json([]);
  if (path === '/rest/v1/commerce_orders') return json({stripe_checkout_session_id:'cs_test_proof',total:2999,status:'READY_FOR_FULFILLMENT'});
  if (path === '/rest/v1/marketing_automation_enrolled_subjects') {
    if (url.searchParams.has('user_id')) { subjectReads++; return json(withdrawBeforeSend&&subjectReads>=2?null:subject); }
    return json(subject?[subject]:[]);
  }
  if (path === '/rest/v1/rpc/queue_marketing_automation') {
    if (job) return json(null);
    job = {id,user_id:id,consent_id:id,key:body.p_key,step:body.p_step,anchor:body.p_anchor,due_at:body.p_due,
      revision:body.p_revision,template_digest:body.p_digest,status:'pending',claim_id:id,provider_payload:null}; return json(id);
  }
  if (path === '/rest/v1/rpc/claim_marketing_automation') {
    if (job?.status!=='pending') return json([]);
    job.status='processing'; return json([{...job}]);
  }
  if (path === '/rest/v1/marketing_automation_jobs') {
    if (req.method==='GET') {
      if (url.searchParams.has('id')) return json({status:job?.status==='pending'?'processing':job?.status,claim_id:id});
      return json(job?.status==='sent'?[{key:job.key,step:job.step,anchor:job.anchor,sent_at:job.sent_at}]:[]);
    }
    if (body.status==='sent'&&receiptFailure) return json({message:'fixture unavailable'},503);
    Object.assign(job,body); saved.push(body); return json([{id}]);
  }
  if (url.hostname==='api.resend.com'&&path==='/emails') {
    assert.equal(body.to,'sink@example.invalid'); assert.ok(body.text.includes('Baja: https://imperioes.com/comunicaciones/baja?token='));
    sends.push({body,key:req.headers.get('idempotency-key')});
    if (providerFailure) return json({name:'application_error',message:'fixture failure'},500);
    emails++; return json({id:'provider_fixture'});
  }
  throw Error(`Unexpected worker fixture ${req.method} ${path}`);
};
const directory = new URL('../.vercel/output/functions/_render.func/dist/server/chunks/',import.meta.url);
const name = readdirSync(directory).find(name=>name.startsWith('automation-worker_')&&name.endsWith('.mjs'));
assert.ok(name);
const module = await import(new URL(name,directory).href);
const run = Object.values(module).find(value=>typeof value==='function'&&value.name==='runMarketingAutomations'); assert.ok(run);
let result = await run(1); assert.equal(result.sent,1); assert.equal(job.status,'sent'); assert.equal(job.provider_payload,null);
assert.equal((await run(1)).sent,0); assert.equal(emails,1);
job=null; subject=structuredClone(baseline); subjectReads=0; withdrawBeforeSend=true;
result=await run(1); assert.equal(result.suppressed,1); assert.equal(emails,1); assert.equal(job.status,'suppressed');
withdrawBeforeSend=false; subjectReads=0; job=null; providerFailure=true;
result=await run(1); assert.equal(result.failed,1); assert.ok(job.provider_payload);
const first=sends.at(-1); providerFailure=false; receiptFailure=true;
job.status='pending'; // Simulate lease expiry; real lease behavior is covered by SQL tests.
result=await run(1); assert.equal(result.failed,1); assert.deepEqual(sends.at(-1),first);
receiptFailure=false; job.status='pending'; result=await run(1); assert.equal(result.sent,1); assert.deepEqual(sends.at(-1),first);
const before=sends.length;
runtime.enrollment_starts_at=null;assert.equal((await run(1)).disabled,true);assert.equal(sends.length,before);
runtime.enrollment_starts_at=new Date(now+3600000).toISOString();assert.equal((await run(1)).disabled,true);
runtime.enrollment_starts_at=ago(72);
runtime.template_digest='changed';
assert.equal((await run(1)).disabled,true); assert.equal(sends.length,before);
process.env.MARKETING_AUTOMATIONS_ENABLED='false'; assert.equal((await run(1)).disabled,true);
assert.ok(readFileSync('supabase/migrations/032_marketing_automation_worker.sql','utf8').includes("values(true)"));
console.log('Automation compiled worker: approval gate, verified candidates, send-time withdrawal, immutable provider retries, deduplication, unsubscribe and template reapproval passed. No real emails or external network.');
process.env.COMMERCE_JOB_SECRET='fixture-maintenance-secret-with-at-least-32-characters';
process.env.MARKETING_AUTOMATIONS_ENABLED='true';
const maintenanceCalls=[];
globalThis.fetch=async(input,init)=>{
  const request=input instanceof Request?input:new Request(input,init),path=new URL(request.url).pathname;
  maintenanceCalls.push(path);
  if(path==='/rest/v1/marketing_automation_runtime')return json({message:'fixture worker unavailable'},503);
  if(path==='/rest/v1/commerce_campaign')return json({purchase_activated:false});
  if(path.startsWith('/rest/v1/'))return json([]);
  throw Error('No provider transport in maintenance failure fixture');
};
const {default:app}=await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
const denied=await app.fetch(new Request('https://imperioes.com/api/commerce-maintenance',{method:'POST',headers:{'Content-Type':'application/json'}}));
assert.equal(denied.status,403);assert.equal(maintenanceCalls.length,0);
const maintenance=await app.fetch(new Request('https://imperioes.com/api/commerce-maintenance',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.COMMERCE_JOB_SECRET}`}}));
assert.equal(maintenance.status,200);const summary=await maintenance.json();assert.equal(summary.marketing.failed,true);
assert.ok(maintenanceCalls.indexOf('/rest/v1/rpc/claim_paid_order_admin_notice')<maintenanceCalls.indexOf('/rest/v1/marketing_automation_runtime'));
assert.equal(summary.paidOrderAdminMail.failed,0);
console.log('Authenticated existing scheduler runs order notifications before marketing; marketing failure is isolated. No real emails.');
