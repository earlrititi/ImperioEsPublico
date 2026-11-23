import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const url = new URL(process.env.TEST_DATABASE_URL || "http://missing");
assert.ok(["postgres:","postgresql:"].includes(url.protocol));
assert.equal(url.hostname,"127.0.0.1"); assert.equal(url.pathname,"/crm_fixture"); assert.equal(url.username,"crm_fixture");
const require = createRequire(resolve(process.env.CRM_SQL_TEST_MODULE_ROOT || ".", "package.json"));
const { Client } = require("pg");
const db = new Client({ connectionString: url.href, statement_timeout: 15000 });
await db.connect();
const scalar = async (sql, values=[]) => Object.values((await db.query(sql,values)).rows[0])[0];
try {
  assert.equal(await scalar("select current_database()"),"crm_fixture");
  assert.equal(await scalar("select count(*)::int from public.crm_fixture_migrations where name='060_commercial_mail_coordination.sql'"),1);
  const name="061_crm_performance.sql", sql=readFileSync(new URL("../supabase/migrations/"+name,import.meta.url),"utf8");
  const digest=createHash("sha256").update(sql).digest("hex");
  const previous=await db.query("select digest from public.crm_fixture_migrations where name=$1",[name]);
  if(previous.rowCount) assert.equal(previous.rows[0].digest,digest);
  else {await db.query(sql);await db.query("insert into public.crm_fixture_migrations values($1,$2)",[name,digest]);}
  const suffix=randomUUID();
  const proof=await scalar("select id from public.commerce_orders where stripe_checkout_session_id like 'cs_test_%' limit 1");
  assert.ok(proof,"Run the isolated coordinator fixture first");
  const user=await scalar("select id from auth.users limit 1");
  const reportBefore = await scalar("select public.crm_performance_stats()");
  assert.equal(reportBefore.commerce.net_collected_cents, 0, "Test checkout proof is not Live revenue");
  await db.query("update public.commerce_orders set stripe_checkout_session_id=$2,refunded_amount=500 where id=$1", [proof, `cs_live_SYNTHETIC_${proof}`]);
  for (const [event, type, status, amount] of [[`evt_${suffix}_1`, 'invoice.paid','completed',350], [`evt_${suffix}_2`,'invoice.payment_succeeded','completed',350], [`evt_${suffix}_3`,'invoice.paid','failed',9000]])
    await db.query("insert into public.stripe_webhook_events(event_id,event_type,status,invoice_id,amount_paid,currency) values($1,$2,$3,$4,$5,'eur')", [event,type,status, `in_${status}_${suffix}`,amount]);
  const report = await scalar("select public.crm_performance_stats()");
  assert.equal(report.commerce.net_collected_cents, 2499);
  assert.equal(report.commerce.refund_cents, 500);
  assert.equal(report.commerce.recorded_invoice_gross_cents, 350, "A paid invoice is counted once, never from failed events");
  assert.equal(report.commerce.attributed_recovery_orders, null);
  assert.equal(report.commerce.margin_cents, null);
  const expectedPause = { paused: report.policy.paused, kinds: report.policy.kinds };
  assert.deepEqual(await scalar("select public.set_crm_commercial_pause($1,$2,true,array['welcome'])", [user,expectedPause]), {paused:true,kinds:['welcome']});
  await assert.rejects(scalar("select public.set_crm_commercial_pause($1,$2,false,'{}')", [user,expectedPause]), /REQUEST_CONFLICT/);
  assert.equal(await scalar("select has_function_privilege('authenticated','public.crm_performance_stats()','EXECUTE')"), false);
  assert.equal(await scalar("select has_function_privilege('anon','public.set_crm_commercial_pause(uuid,jsonb,boolean,text[])','EXECUTE')"), false);
  console.log("PASS private aggregate revenue, refunds, invoice deduplication, unknown attribution and optimistic reversible pause.");
} finally {await db.end();}
