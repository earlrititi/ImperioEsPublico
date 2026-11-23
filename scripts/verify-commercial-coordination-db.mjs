import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Deliberately cannot target a linked Supabase database or accept a remote host.
const url = new URL(process.env.TEST_DATABASE_URL || "http://missing");
assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "Explicit local TEST_DATABASE_URL required");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/crm_fixture");
assert.equal(url.username, "crm_fixture");
const require = createRequire(resolve(process.env.CRM_SQL_TEST_MODULE_ROOT || ".", "package.json"));
const { Client } = require("pg");
const connection = () => new Client({ connectionString: url.href, statement_timeout: 15000 });
const db = connection();
await db.connect();
const scalar = async (sql, values = [], client = db) => Object.values((await client.query(sql, values)).rows[0])[0];
try {
  assert.equal(await scalar("select current_database()"), "crm_fixture");
  const marked = await scalar("select to_regclass('public.crm_fixture_migrations') is not null");
  const populated = await scalar("select to_regclass('public.profiles') is not null");
  assert.ok(!populated || marked, "Refusing an unmarked populated database");
  if (process.env.CRM_SQL_RESET === "1") {
    // The host, account, database name and fixture marker are checked above.
    await db.query("drop schema public cascade; drop schema if exists auth cascade; drop schema if exists private cascade; drop schema if exists storage cascade; drop schema if exists vault cascade; drop schema if exists net cascade; create schema public");
  }
  await db.query(`do $$begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;
  end $$;
  create schema if not exists auth;
  create table if not exists auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz default now());
  create or replace function auth.uid() returns uuid language sql as $$select null::uuid$$;
  create schema if not exists storage;
  create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create schema if not exists vault;
  create table if not exists vault.decrypted_secrets(name text,decrypted_secret text);
  create schema if not exists net;
  create or replace function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 0::bigint$$;
  create table if not exists public.crm_fixture_migrations(name text primary key,digest text not null);`);
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const name of readdirSync(migrations).filter(name => /^0\d\d_.*\.sql$/.test(name) && Number(name.slice(0, 3)) <= 60).sort()) {
    const sql = readFileSync(new URL(name, migrations), "utf8").replace(/create extension if not exists "pgcrypto";/i, "");
    const digest = createHash("sha256").update(sql).digest("hex");
    const previous = await db.query("select digest from public.crm_fixture_migrations where name=$1", [name]);
    if (previous.rowCount) { assert.equal(previous.rows[0].digest, digest, "Changed migration; reset the marked fixture explicitly"); continue; }
    try { await db.query(sql); }
    catch (error) { await db.query("rollback"); throw new Error(`${name}: ${error.message}`); }
    await db.query("insert into public.crm_fixture_migrations values($1,$2)", [name, digest]);
  }
  console.log("All source migrations through 060 applied to isolated PostgreSQL; Auth/storage/network are synthetic.");
  const suffix = randomUUID();
  const user = randomUUID(), consent = randomUUID(), email = `coord-${suffix}@example.invalid`;
  await db.query("insert into auth.users(id,email,email_confirmed_at,created_at) values($1,$2,now()-interval '13 days',now()-interval '13 days')", [user, email]);
  await db.query("insert into public.legal_consents(id,user_id,consent_type,document_version,accepted,source,created_at) values($1,$2,'marketing_email','2026-11-06',true,'synthetic',now()-interval '13 days')", [consent, user]);
  await db.query("insert into public.legal_consents(user_id,consent_type,document_version,accepted,source) values($1,'cookies_analytics','2026-11-06',true,'synthetic')", [user]);
  // Runtime proof is synthetic; never creates or charges a provider payment.
  const reservation = randomUUID(), proof = randomUUID();
  await db.query(`insert into public.reservations(id,request_id,payload_hash,token_hash,status,customer_name,customer_email,shipping_address,total_quantity,total_price_snapshot,terms_version,privacy_version)
    values($1,$2,'fixture',repeat('a',64),'CONVERTED_TO_ORDER','Synthetic proof','proof@example.invalid','{}',1,2999,'2026-11-06','2026-11-06')`, [reservation, randomUUID()]);
  await db.query(`insert into public.commerce_orders(id,reservation_id,reservation_number,customer_name,customer_email,shipping_address,total_quantity,subtotal,total,currency,stripe_checkout_session_id,stripe_payment_intent_id,paid_at)
    values($1,$2,'SYNTHETIC','Synthetic proof','proof@example.invalid','{}',1,2999,2999,'eur',$3,$4,now())`, [proof, reservation, `cs_test_${proof}`, `pi_test_${proof}`]);
  await db.query("update public.marketing_automation_runtime set enabled=true,approved_by=$1,approved_at=now()-interval '13 days',enrollment_starts_at=now()-interval '14 days',recovery_activity_starts_at=now()-interval '13 days',purchase_proof_id=$2,template_digest=repeat('a',64),commercial_paused=false,commercial_paused_kinds='{}'", [user, proof]);
  const adminJob = async (recipient = email, type = "individual") => {
    const id = randomUUID(), claim = randomUUID();
    await db.query("insert into public.email_logs(id,recipient,type,subject,content,admin_id,status,claim_id,claimed_at) values($1,$2,$3,'Synthetic subject','Synthetic body',$4,'processing',$5,now())", [id, recipient, type, user, claim]);
    return { id, claim };
  };
  const reserve = async (job, source = "admin", client = db, digest = "b".repeat(64)) => scalar("select public.reserve_commercial_mail($1,$2,$3,$4,'2026-11-06')", [source, job.id, job.claim, digest], client);
  const freshClaim = async job => {
    job.claim = randomUUID();
    await db.query("update public.email_logs set status='processing',claim_id=$2,claimed_at=now(),next_attempt_at=now() where id=$1", [job.id, job.claim]);
  };
  const clearHistory = async () => {
    // Synthetic-only scope; retained production and historical data are unreachable.
    await db.query("delete from public.customer_mail_deliveries where recipient=$1", [email]);
    await db.query("update public.email_logs set status='suppressed' where recipient=$1", [email]);
    await db.query("update public.marketing_automation_jobs set status='suppressed' where identity_email=$1", [email]);
  };
  // Two independent database connections race for one recipient slot.
  const first = await adminJob(), second = await adminJob();
  const a = connection(), b = connection(); await Promise.all([a.connect(), b.connect()]);
  try {
    const results = await Promise.all([reserve(first, "admin", a), reserve(second, "admin", b)]);
    assert.equal(results.filter(row => row.action === "send").length, 1);
    assert.equal(results.filter(row => row.action === "deferred").length, 1);
    const winner = results[0].action === "send" ? first : second;
    const receipt = results.find(row => row.action === "send");
    assert.equal((await reserve(winner)).reason, "COMMERCIAL_ATTEMPT_IN_FLIGHT");
    assert.equal(await scalar("select public.complete_customer_mail($1,$2,'provider_synthetic')", [receipt.receipt_id, receipt.receipt_claim_id]), true);
    assert.equal((await reserve(winner)).action, "accepted");
    await scalar("select public.finish_admin_mail($1,$2,'sent','provider_synthetic')", [winner.id, winner.claim]);
    assert.equal(await scalar("select count(*)::int from public.commercial_mail_history where email=$1", [email]), 1, "Source and receipt must not double count");
  } finally { await Promise.all([a.end(), b.end()]); }
  console.log("PASS concurrent independent workers, in-flight ownership, accepted reconciliation and history deduplication.");

  await clearHistory();
  const noConsent = await adminJob(`none-${suffix}@example.invalid`);
  assert.equal((await reserve(noConsent)).action, "suppressed");
  const unverifiedUser = randomUUID(), unverified = `unverified-${suffix}@example.invalid`;
  await db.query("insert into auth.users(id,email) values($1,$2)", [unverifiedUser, unverified]);
  await db.query("insert into public.legal_consents(user_id,consent_type,document_version,accepted,source) values($1,'marketing_email','2026-11-06',true,'synthetic')", [unverifiedUser]);
  assert.equal((await reserve(await adminJob(unverified))).action, "suppressed");
  const withdrawn = await adminJob();
  await scalar("select public.suppress_marketing_email($1,'unsubscribe')", [email]);
  assert.equal((await reserve(withdrawn)).action, "suppressed");
  await db.query("delete from public.email_suppressions where email=$1", [email]);
  console.log("PASS absent consent, unverified identity and last-moment unsubscribe fail closed.");

  const paused = await adminJob();
  await db.query("update public.marketing_automation_runtime set commercial_paused_kinds=array['editorial']");
  assert.equal((await reserve(paused)).reason, "COMMERCIAL_PAUSED");
  assert.equal(await scalar("select first_attempt_at is null and attempts=0 from public.email_logs where id=$1", [paused.id]), true);
  await db.query("update public.marketing_automation_runtime set commercial_paused_kinds='{}'");
  await freshClaim(paused);
  const uncertain = await reserve(paused);
  assert.equal(uncertain.action, "send");
  assert.equal(await scalar("select public.fail_customer_mail($1,$2,'COMMERCIAL_RESULT_UNCERTAIN')", [uncertain.receipt_id, uncertain.receipt_claim_id]), true);
  await db.query("update public.customer_mail_deliveries set created_at=now()-interval '2 days' where id=$1", [uncertain.receipt_id]);
  assert.equal((await reserve(await adminJob())).action, "deferred", "Expired uncertain outcomes still hold the slot");
  await freshClaim(paused);
  assert.equal((await reserve(paused)).action, "review");
  console.log("PASS reversible family pause, deferred jobs retain fresh retry windows, uncertain outcomes require review.");

  await clearHistory();
  // Weekly frequency counts cross-source receipts, with the daily slot free.
  for (const days of [2, 4, 6]) await db.query(`insert into public.customer_mail_deliveries(key,request_digest,payload_digest,recipient,subject,flow,status,commercial_source,commercial_job_id,created_at,sent_at,provider_id)
    values($1,repeat('a',64),repeat('b',64),$2,'Synthetic','commercial_admin','sent','admin',$3,now()-$4::interval,now()-$4::interval,$5)`, [randomUUID(), email, randomUUID(), `${days} days`, `provider_${days}_${suffix}`]);
  const weekly = await adminJob();
  assert.equal((await reserve(weekly)).action, "deferred");
  assert.equal(await scalar("select first_attempt_at is null from public.email_logs where id=$1", [weekly.id]), true);
  console.log("PASS shared weekly limit without consuming the provider retry clock.");

  await clearHistory();
  const anchor = await scalar("select now()-interval '2 hours'");
  await db.query("insert into public.marketing_automation_activity(user_id,checkout_at) values($1,$2) on conflict(user_id) do update set checkout_at=excluded.checkout_at", [user, anchor]);
  const recovery = await scalar("select public.queue_marketing_automation($1,$2,'checkout','hour1',$3,$3,0,repeat('a',64))", [user, consent, anchor]);
  assert.ok(recovery);
  const editorial = await adminJob();
  assert.equal((await reserve(editorial)).action, "deferred", "Eligible checkout precedes editorial regardless of invocation order");
  const recoveryClaim = randomUUID();
  await db.query("update public.marketing_automation_jobs set status='processing',claim_id=$2,claimed_at=now() where id=$1", [recovery, recoveryClaim]);
  // A purchase arrives after enqueue, before the final reservation.
  await db.query("update public.commerce_orders set customer_email=$1 where id=$2", [email, proof]);
  assert.equal((await reserve({ id:recovery,claim:recoveryClaim }, "automation")).action, "suppressed");
  assert.equal(await scalar("select public.queue_marketing_automation($1,$2,'checkout','hour24',$3,$3,0,repeat('a',64))", [user, consent, anchor]), null);
  assert.ok(await scalar("select public.queue_marketing_automation($1,$2,'welcome','day3',now()-interval '13 days',now()-interval '10 days',0,repeat('a',64))", [user, consent]));
  assert.equal(await scalar("select public.queue_marketing_automation($1,$2,'welcome','day8',now()-interval '13 days',now()-interval '5 days',0,repeat('a',64))", [user, consent]), null);
  console.log("PASS checkout priority, purchase after enqueue blocks recovery, editorial welcome allowed after purchase, converted offer suppressed.");

  await clearHistory();
  await db.query("insert into public.marketing_automation_jobs(user_id,identity_email,consent_id,key,step,anchor,due_at,revision,template_digest,status,sent_at) values($1,$2,$3,'welcome','day1',now()-interval '1 year',now()-interval '1 year',0,repeat('a',64),'sent',now()-interval '1 year')", [user, email, consent]);
  assert.equal(await scalar("select public.queue_contact_welcome($1,'day1',now()-interval '12 days',0,repeat('a',64))", [email.toUpperCase()]), null);
  assert.equal(await scalar("select count(*)::int from public.commercial_automation_history($1) where step='day1'", [email]), 1);
  const wrongLease = await adminJob();
  await assert.rejects(scalar("select public.finish_admin_mail($1,$2,'sent','provider_wrong')", [wrongLease.id, randomUUID()]), /EMAIL_RECEIPT_UNAVAILABLE/);
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await scalar("select has_function_privilege($1,'public.reserve_commercial_mail(text,uuid,uuid,text,text)','EXECUTE')", [role]), false);
    assert.equal(await scalar("select has_table_privilege($1,'public.commercial_mail_history','SELECT')", [role]), false);
  }
  console.log("PASS lifetime normalized welcome history, stale lease refusal and service-only grants.");
  const service = await adminJob(`support-${suffix}@example.invalid`);
  await db.query("update public.email_logs set purpose='service',status='sent',sent_at=now(),provider_message_id='service_fixture' where id=$1",[service.id]);
  assert.equal(await scalar("select count(*)::int from public.commercial_mail_history where job_id=$1",[service.id]),0);
  await assert.rejects(db.query("update public.email_logs set type='campaign' where id=$1",[service.id]),/email_logs_purpose_check/);
  const content={subject:'Service',preheader:'',content:'Requested support response',cta_label:'',cta_url:'',purpose:'service'};
  const queuedService=randomUUID();
  await scalar("select public.queue_individual_mail($1,$2,$3,'individual',$4)",[queuedService,user,`support-${suffix}@example.invalid`,content]);
  await assert.rejects(scalar("select public.queue_individual_mail($1,$2,$3,'individual',$4)",[queuedService,user,`support-${suffix}@example.invalid`,{...content,purpose:'commercial'}]),/REQUEST_CONFLICT/);
  console.log("PASS explicit individual service purpose stays outside promotional history and cannot be changed by replay.");

} finally { await db.end(); }
