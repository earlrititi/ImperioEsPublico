import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const file='.env.reservation-test.local',env=parseEnv(readFileSync(file,'utf8')),local=parseEnv(readFileSync('.env.local','utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL,'https://joicpkgvggfxzrdazisx.supabase.co');
const db=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const customers=await db.from('reservations').select('customer_email');assert.ifError(customers.error);
assert.ok(customers.data.every(r=>r.customer_email.endsWith('@example.invalid')),'Only synthetic Test reservations may be emailed by this test');
if(!local.RESEND_API_KEY||!local.RESEND_FROM_EMAIL){console.log('Resend configuration missing. No email sent.');process.exitCode=1;}
else {
  env.RESEND_API_KEY=local.RESEND_API_KEY;env.RESEND_FROM_EMAIL=local.RESEND_FROM_EMAIL;
  env.COMMERCE_EMAIL_MODE='test';env.COMMERCE_TEST_EMAIL='delivered+imperio-reservas@resend.dev';env.COMMERCE_JOB_SECRET||=randomBytes(32).toString('hex');
  const content=Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n';
  if(content!==readFileSync(file,'utf8')){writeFileSync(file,content,{mode:0o600});await new Promise(r=>setTimeout(r,8000));}
  const response=await fetch('http://127.0.0.1:4323/api/commerce-maintenance',{method:'POST',headers:{Authorization:`Bearer ${env.COMMERCE_JOB_SECRET}`,'Content-Type':'application/json'},body:'{}'});
  assert.equal(response.status,200);const result=await response.json();
  const jobs=await db.from('commerce_outbox').select('id,status,provider_id,encrypted_message');assert.ifError(jobs.error);
  assert.ok(jobs.data.some(j=>j.status==='SENT'),'No email was accepted; inspect provider configuration without logging secrets.');
  assert.ok(jobs.data.filter(j=>j.status==='SENT').every(j=>j.provider_id&&j.encrypted_message===null));
  const response2=await fetch('http://127.0.0.1:4323/api/commerce-maintenance',{method:'POST',headers:{Authorization:`Bearer ${env.COMMERCE_JOB_SECRET}`,'Content-Type':'application/json'},body:'{}'});
  assert.equal(response2.status,200);assert.equal((await response2.json()).sent,0);
  console.log(JSON.stringify({provider:'Resend',recipient:'delivered+imperio-reservas@resend.dev',accepted:result.sent,duplicateRunSent:0,productionChanged:false}));
}
