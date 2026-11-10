const {PGlite}=await import(process.env.PGLITE_MODULE_PATH || "@electric-sql/pglite");
import {readFileSync,readdirSync} from "node:fs";
import assert from "node:assert/strict";
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz default now());
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
create schema net;create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 0::bigint$$;`);
const dir=new URL("../supabase/migrations/",import.meta.url);
for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort()){
  let sql=readFileSync(new URL(name,dir),'utf8');
  // Core UUID generation is present. This extension alone is not bundled in WASM.
  sql=sql.replace(/create extension if not exists "pgcrypto";/i,'');
  try{await db.exec(sql);console.log(`Applied ${name}`);}catch(error){console.error(`FAILED ${name}: ${error.message}`);process.exitCode=1;await db.close();process.exit();}
}
console.log('All source migrations applied to temporary PostgreSQL with mocked Auth/storage/network services.');
const user='00000000-0000-4000-8000-000000000011',proof='00000000-0000-4000-8000-000000000012',verification='00000000-0000-4000-8000-000000000013';
await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${user}','verified@example.invalid',now());
insert into public.legal_consents(id,user_id,consent_type,document_version,accepted,source) values('${proof}','${user}','marketing_email','2026-11-06',true,'registration');`);
assert.equal((await db.query('select count(*)::int as n from public.marketing_email_contacts')).rows[0].n,1);
await db.exec(`insert into public.legal_consents(id,anonymous_id,consent_type,document_version,accepted,source) values('${verification}','${verification}','marketing_email','2026-11-06',true,'newsletter_pdf');
insert into public.marketing_email_verifications(id,email,source,context_id,consent_id,token_hash,expires_at) values('${verification}','anonymous@example.invalid','newsletter_pdf','test','${verification}',repeat('a',64),now()+interval '1 day');`);
assert.equal((await db.query('select count(*)::int as n from public.marketing_email_contacts')).rows[0].n,1);
assert.equal((await db.query(`select public.confirm_marketing_email('${verification}',repeat('b',64)) as ok`)).rows[0].ok,false);
assert.equal((await db.query(`select public.confirm_marketing_email('${verification}',repeat('a',64)) as ok`)).rows[0].ok,true);
assert.equal((await db.query(`select public.confirm_marketing_email('${verification}',repeat('a',64)) as ok`)).rows[0].ok,false);
assert.equal((await db.query('select count(*)::int as n from public.marketing_email_contacts')).rows[0].n,2);
await db.exec(`insert into public.email_suppressions(email,reason) values('anonymous@example.invalid','unsubscribe');`);
assert.equal((await db.query('select count(*)::int as n from public.marketing_email_contacts')).rows[0].n,1);
for(const table of ['marketing_email_contacts','marketing_email_verifications','marketing_subscription_notices','admin_communication_records','admin_audience_contacts']){
  const r=await db.query(`select has_table_privilege('anon',$1,'SELECT') as allowed`,['public.'+table]);assert.equal(r.rows[0].allowed,false,table);
}
console.log('Verified: pending vs verified opt-in, token mismatch/replay, normalized eligible audience, withdrawal, anonymous data permissions.');

// Actual PostgreSQL post-delivery execution, using synthetic records and no
// payments, email provider or external network. Every row dies with this DB.
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const uuid=async()=>scalar('select gen_random_uuid()');
const createDeliveryOrder=async()=>{
  const r=await uuid(),o=await uuid(),request=await uuid();
  await db.query(`insert into public.reservations(id,request_id,payload_hash,token_hash,user_id,status,customer_name,customer_email,shipping_address,
    total_quantity,total_price_snapshot,terms_version,privacy_version)
    values($1,$2,'fixture',repeat('c',64),$3,'CONVERTED_TO_ORDER','Synthetic Test','verified@example.invalid','{}',2,5998,'2026-11-06','2026-11-06')`,[r,request,user]);
  await db.query(`insert into public.commerce_orders(id,reservation_id,reservation_number,customer_name,customer_email,shipping_address,
    total_quantity,subtotal,total,currency,stripe_checkout_session_id,stripe_payment_intent_id,paid_at)
    values($1,$2,'SYNTHETIC','Synthetic Test','verified@example.invalid','{}',2,5998,5998,'eur',$3,$4,now()-interval '10 days')`,[o,r,`cs_test_${o}`,`pi_test_${o}`]);
  await db.query('update public.reservations set order_id=$1 where id=$2',[o,r]);return o;
};
const event=async(order,kind,index,count,age,evidence='private-test-ticket',key=null)=>{
  const eventId=key??await uuid();
  const result=await scalar(`select public.record_commerce_delivery($1,$2,$3,$4,now()-$5::interval,$6,$7,'admin_evidence',$8)`,
    [order,kind,index,count,age,evidence,user,eventId]);return {result,eventId};
};
const orderRow=async id=>(await db.query(`select carrier_delivered_at,customer_received_at,delivery_issue_at,status from public.commerce_orders where id=$1`,[id])).rows[0];
const first=await createDeliveryOrder();
await assert.rejects(event(first,'carrier_delivered',1,2,'5 days',''),/DELIVERY_EVIDENCE_REQUIRED/);
await assert.rejects(event(first,'carrier_delivered',3,2,'5 days'),/INVALID_INPUT/);
const partial=await event(first,'carrier_delivered',1,2,'5 days');
assert.equal(partial.result.complete,false);assert.equal((await orderRow(first)).carrier_delivered_at,null);
const duplicate=await event(first,'carrier_delivered',1,2,'5 days','private-test-ticket',partial.eventId);
assert.equal(duplicate.result.duplicate,true);
assert.equal(await scalar('select count(*)::int from public.commerce_delivery_events where order_id=$1',[first]),1);
await assert.rejects(event(first,'carrier_delivered',2,3,'4 days'),/DELIVERY_PACKAGE_COUNT_MISMATCH/);
const complete=await event(first,'carrier_delivered',2,2,'4 days');
assert.equal(complete.result.complete,true);assert.ok((await orderRow(first)).carrier_delivered_at);assert.equal((await orderRow(first)).customer_received_at,null);
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,true)`);
assert.equal(await scalar(`select count(*)::int from public.post_delivery_jobs where order_id=$1 and kind='delivery_check'`,[first]),1);
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,true)`);
assert.equal(await scalar(`select count(*)::int from public.post_delivery_jobs where order_id=$1`,[first]),1);
await assert.rejects(scalar(`select public.update_commerce_fulfillment($1,'DELIVERED','Test','tracking',$2)`,[first,user]),/INVALID_STATE/);

await event(first,'issue_opened',1,2,'1 day','test-support-ticket');
assert.equal(await scalar(`select status from public.post_delivery_jobs where order_id=$1`,[first]),'cancelled');
await event(first,'issue_resolved',1,2,'2 days','test-resolution-old');
assert.ok((await orderRow(first)).delivery_issue_at);
await event(first,'issue_resolved',1,2,'12 hours','test-resolution-new');
assert.equal((await orderRow(first)).delivery_issue_at,null);
await event(first,'issue_opened',1,2,'2 days','test-late-old-issue');
assert.equal((await orderRow(first)).delivery_issue_at,null);

const customerFirst=await createDeliveryOrder();
const customerEvent=await uuid();
const received=await scalar(`select public.confirm_commerce_receipt($1,null,null,$2,'customer_received',1,1,$3)`,[customerFirst,user,customerEvent]);
assert.equal(received.complete,true);assert.ok((await orderRow(customerFirst)).customer_received_at);assert.equal((await orderRow(customerFirst)).carrier_delivered_at,null);
await event(customerFirst,'carrier_delivered',1,1,'2 days');
assert.ok((await orderRow(customerFirst)).carrier_delivered_at);
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,true)`);
assert.equal(await scalar(`select count(*)::int from public.post_delivery_jobs where order_id=$1 and kind='delivery_check'`,[customerFirst]),0);
assert.equal(await scalar(`select count(*)::int from public.post_delivery_jobs where order_id=$1 and kind='post_delivery_loyalty'`,[customerFirst]),1);

const refunded=await createDeliveryOrder();await event(refunded,'carrier_delivered',1,1,'3 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
assert.ok(await scalar(`select next_email_at from public.commerce_orders where id=$1`,[refunded]));
await db.query(`update public.commerce_orders set refunded_amount=1 where id=$1`,[refunded]);
assert.equal(await scalar(`select status from public.post_delivery_jobs where order_id=$1`,[refunded]),'cancelled');
assert.equal(await scalar(`select next_email_at from public.commerce_orders where id=$1`,[refunded]),null);
assert.equal(await scalar(`select post_delivery_stage from public.commerce_orders where id=$1`,[refunded]),'refunded');
const cancelled=await createDeliveryOrder();await event(cancelled,'carrier_delivered',1,1,'3 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
await db.query(`update public.commerce_orders set status='CANCELLED' where id=$1`,[cancelled]);
assert.equal(await scalar(`select status from public.post_delivery_jobs where order_id=$1`,[cancelled]),'cancelled');
assert.equal(await scalar(`select next_email_at from public.commerce_orders where id=$1`,[cancelled]),null);
assert.equal(await scalar(`select post_delivery_stage from public.commerce_orders where id=$1`,[cancelled]),'cancelled');
const returned=await createDeliveryOrder();await event(returned,'carrier_delivered',1,1,'3 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
await event(returned,'returned',1,1,'1 day','test-physical-return');
assert.equal(await scalar(`select status from public.post_delivery_jobs where order_id=$1`,[returned]),'cancelled');

const linked=await createDeliveryOrder();await event(linked,'carrier_delivered',1,2,'3 days');await event(linked,'carrier_delivered',2,2,'2 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
const job=(await db.query(`update public.post_delivery_jobs set status='sent',provider_id='synthetic-no-send',token_expires_at=date_trunc('milliseconds',now()+interval '1 day') where order_id=$1 returning id,token_expires_at`,[linked])).rows[0];
const used=await scalar(`select public.confirm_commerce_receipt($1,$2,$3,null,'customer_received',1,2,$4)`,[linked,job.id,job.token_expires_at,await uuid()]);
assert.equal(used.complete,false);assert.equal(await scalar(`select token_used_at from public.post_delivery_jobs where id=$1`,[job.id]),null);
const full=await scalar(`select public.confirm_commerce_receipt($1,$2,$3,null,'customer_received',2,2,$4)`,[linked,job.id,job.token_expires_at,await uuid()]);
assert.equal(full.complete,true);assert.ok(await scalar(`select token_used_at from public.post_delivery_jobs where id=$1`,[job.id]));
await assert.rejects(scalar(`select public.confirm_commerce_receipt($1,$2,$3,null,'issue_opened',1,2,$4)`,[linked,job.id,job.token_expires_at,await uuid()]),/NOT_FOUND/);

const expired=await createDeliveryOrder();await event(expired,'carrier_delivered',1,1,'3 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
const expiredJob=(await db.query(`update public.post_delivery_jobs set status='sent',token_expires_at=date_trunc('milliseconds',now()-interval '1 hour') where order_id=$1 returning id,token_expires_at`,[expired])).rows[0];
await assert.rejects(scalar(`select public.confirm_commerce_receipt($1,$2,$3,null,'customer_received',1,1,$4)`,[expired,expiredJob.id,expiredJob.token_expires_at,await uuid()]),/NOT_FOUND/);
await assert.rejects(scalar(`select public.confirm_commerce_receipt($1,null,null,$2,'customer_received',1,1,$3)`,[expired,await uuid(),await uuid()]),/NOT_FOUND/);
const claimOrder=await createDeliveryOrder();await event(claimOrder,'carrier_delivered',1,1,'3 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
const claimed=(await db.query(`select * from public.claim_post_delivery_job(false)`)).rows;
assert.equal(claimed.length,1);assert.equal(claimed[0].order_id,claimOrder);assert.ok(claimed[0].claim_id);
assert.equal((await db.query(`select * from public.claim_post_delivery_job(false)`)).rows.length,0);
await db.query(`update public.post_delivery_jobs set first_attempt_at=now()-interval '24 hours',claimed_at=now()-interval '10 minutes' where id=$1`,[claimed[0].id]);
assert.equal((await db.query(`select * from public.claim_post_delivery_job(false)`)).rows.length,0);
assert.equal(await scalar(`select status from public.post_delivery_jobs where id=$1`,[claimed[0].id]),'review');
const disputed=await createDeliveryOrder();await event(disputed,'carrier_delivered',1,1,'3 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
await scalar(`select public.record_commerce_dispute($1,'du_synthetic',now()-interval '1 hour')`,[`pi_test_${disputed}`]);
assert.equal(await scalar(`select status from public.post_delivery_jobs where order_id=$1`,[disputed]),'cancelled');
await scalar(`select public.record_commerce_dispute($1,'du_synthetic',now()-interval '1 hour')`,[`pi_test_${disputed}`]);
assert.equal(await scalar(`select count(*)::int from public.commerce_audit where entity_id=$1 and action='post_delivery:stripe_dispute:du_synthetic'`,[disputed]),1);
assert.equal(await scalar(`select refunded_amount::int from public.commerce_orders where id=$1`,[disputed]),0);
await db.query(`update public.post_delivery_jobs set due_at=now()-interval '1 hour' where order_id=$1 and kind='post_delivery_loyalty'`,[customerFirst]);
await db.query(`insert into public.email_suppressions(email,reason) values('verified@example.invalid','unsubscribe')`);
assert.equal((await db.query(`select * from public.claim_post_delivery_job(true)`)).rows.length,0);
assert.equal(await scalar(`select status from public.post_delivery_jobs where order_id=$1 and kind='post_delivery_loyalty'`,[customerFirst]),'cancelled');
for(const table of ['commerce_delivery_events','post_delivery_jobs'])
  assert.equal(await scalar(`select has_table_privilege('anon',$1,'SELECT')`,['public.'+table]),false);
assert.equal(await scalar(`select has_function_privilege('anon','public.confirm_commerce_receipt(uuid,uuid,timestamptz,uuid,text,integer,integer,uuid)','EXECUTE')`),false);
const maximumDelay=await createDeliveryOrder();await event(maximumDelay,'carrier_delivered',1,1,'0 days');
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',336,24,false)`);
assert.equal(await scalar(`select token_expires_at=date_trunc('milliseconds',due_at+interval '14 days') from public.post_delivery_jobs where order_id=$1 and kind='delivery_check'`,[maximumDelay]),true,
  'The maximum scheduling delay must preserve the full response window after the scheduled send');
const originalExpiry=await scalar(`select token_expires_at from public.post_delivery_jobs where order_id=$1`,[maximumDelay]);
await scalar(`select public.queue_post_delivery_jobs(now()-interval '7 days',24,24,false)`);
assert.deepEqual(await scalar(`select token_expires_at from public.post_delivery_jobs where order_id=$1`,[maximumDelay]),originalExpiry,
  'Requeueing must not rotate the capability or extend an existing response window');
console.log('Verified PostgreSQL: evidence required, two-package partial/full delivery, repeated event and queue deduplication, count mismatch, old delivery transition blocked, out-of-order issues/resolutions, customer-first receipt, loyalty consent read model, refund/cancellation read-model cleanup, return cancellation, limited receipt link partial/full/expiry/replay, account ownership, exclusive worker claims, expired provider retry window, withdrawal before loyalty claim, maximum-delay response window, immutable queued expiry and anonymous permissions.');
const welcomeUser=await uuid(),welcomeProof=await uuid();
await db.query(`insert into auth.users(id,email,email_confirmed_at) values($1,'welcome@example.invalid',now());
`,[welcomeUser]);
await db.query(`insert into public.legal_consents(id,user_id,consent_type,document_version,accepted,source) values($1,$2,'marketing_email','2026-11-06',true,'registration')`,[welcomeProof,welcomeUser]);
await db.query(`update public.marketing_automation_runtime set enabled=true,approved_by=$1,approved_at=now(),purchase_proof_id=$2,template_digest=repeat('d',64),enrollment_starts_at=now()-interval '1 day' where id`,[user,first]);
await db.query(`update public.commerce_orders set customer_email='welcome@example.invalid' where id=$1`,[first]);
const welcomeJob=await scalar(`select public.queue_contact_welcome('welcome@example.invalid','day1',now(),0,repeat('d',64))`);
assert.ok(welcomeJob,'A consenting verified buyer is eligible for welcome independently of payment');
assert.equal(await scalar(`select public.queue_contact_welcome('welcome@example.invalid','day1',now(),0,repeat('d',64))`),null);
assert.equal((await db.query(`select * from public.claim_marketing_automation()`)).rows.length,0,'Old worker cannot claim central email jobs');
const welcomeClaim=(await db.query(`select * from public.claim_contact_welcome()`)).rows[0];assert.equal(welcomeClaim.id,welcomeJob);
assert.equal((await db.query(`select * from public.claim_contact_welcome()`)).rows.length,0,'Exclusive claims');
await db.query(`insert into public.email_suppressions(email,reason) values('welcome@example.invalid','unsubscribe')`);
assert.equal(await scalar(`select status from public.marketing_automation_jobs where id=$1`,[welcomeJob]),'suppressed');
assert.equal(await scalar(`select public.queue_contact_welcome('welcome@example.invalid','day3',now(),0,repeat('d',64))`),null);
assert.equal(await scalar(`select public.admin_verified_mail_state('sent','opened',null)`),'accepted_by_provider');
assert.equal(await scalar(`select public.admin_verified_mail_state('sent','delivered',null)`),'accepted_by_provider','Historical promoted delivery is not evidence');
assert.equal(await scalar(`select public.admin_verified_mail_state('sent','opened',now())`),'delivered','A separately observed delivered event remains evidence');
assert.equal(await scalar(`select public.admin_verified_mail_state('sent','bounced',now())`),'bounced');
console.log('Verified PostgreSQL: consenting buyer welcome, per-email deduplication, independent exclusive leases, immediate withdrawal and delivery-event provenance without rewriting history.');
await db.close();
