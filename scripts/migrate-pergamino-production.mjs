import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Applies migrations 050-054 to ImperioE production through the Supabase
// Management API (HTTPS) because direct Postgres ports are blocked on some
// networks. Follows the transaction, advisory-lock and schema_migrations
// conventions of migrate-order-price-production.mjs / migrate-email-preferences.mjs.
const project = "pjrqozlyrjgugdraoght";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const apply = process.argv.includes("--apply");
// --cli uses the official CLI's existing authenticated session. Credentials
// remain in native storage; this script never extracts or copies them.
const useCli = process.argv.includes("--cli");
const npmCli = join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const queryDirectory = useCli ? mkdtempSync(join(tmpdir(), "imperio-pergamino-sql-")) : null;
let queryNumber = 0;
const MIGRATIONS = [
  ["050", "central_marketing_contacts"],
  ["051", "post_delivery"],
  ["052", "communications_read_models"],
  ["053", "mailbox_incremental_commit"],
  ["054", "email_funnel"],
];
assert.ok(token || useCli, "Use --cli with an authenticated Supabase CLI, or provide SUPABASE_ACCESS_TOKEN");
if (useCli) assert.ok(existsSync(npmCli), "The Node installation must include npm for --cli");
assert.equal(readFileSync("supabase/.temp/project-ref", "utf8").trim(), project);
const local = readdirSync("supabase/migrations").filter(file => file.endsWith(".sql")).map(file => file.slice(0, 3)).sort();

function body(version, name) {
  let sql = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
  assert.ok(!sql.includes(`$migration${version}$`), `${version}: dollar-quote delimiter collision`);
  sql = sql.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "").trim();
  assert.ok(!/(^|\n)\s*(begin|commit|rollback)\s*;/i.test(sql), `${version}: unexpected transaction control in migration body`);
  return sql;
}

async function query(sql) {
  if (useCli) {
    const queryFile = join(queryDirectory, `${++queryNumber}.sql`);
    writeFileSync(queryFile, sql);
    const result = spawnSync(process.execPath, [npmCli, "exec", "--offline", "--", "supabase", "db", "query",
      `--remote=${project}`, "--file", queryFile, "--output", "json", /^\s*select\b/i.test(sql) ? "--read-only" : "--yes"],
    { encoding: "utf8", timeout: 150000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      // Preserve diagnostic output locally, without exposing database values.
      writeFileSync(`${queryFile}.error.log`, `${result.stdout ?? ""}\n${result.stderr ?? ""}`);
      throw Error(`SUPABASE_CLI_QUERY_FAILED: inspect ${queryFile}.error.log`);
    }
    const data = JSON.parse(result.stdout);
    assert.ok(Array.isArray(data.rows), "Unexpected Supabase CLI query response");
    return data.rows;
  }
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  if (!response.ok) throw Error(`SUPABASE_API_${response.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  const last = Array.isArray(data) && Array.isArray(data[0]) ? data[data.length - 1] : data;
  return Array.isArray(last) ? last : (last?.rows ?? []);
}

const history = await query("select version from supabase_migrations.schema_migrations");
const applied = new Set(history.map(row => row.version));
assert.ok(applied.has("044"), "SEO migrations 041-044 must already be applied");
for (const version of local.filter(version => version < "050")) {
  assert.ok(applied.has(version), `local migration ${version} is missing in production; review before applying`);
}
const pending = MIGRATIONS.filter(([version]) => !applied.has(version));
console.log(JSON.stringify({ project, apply, pending: pending.map(([version]) => version) }));
if (!apply) process.exit(0);

const runtimeBefore = await query("select enabled, enrollment_starts_at::text, template_digest from public.marketing_automation_runtime where id=true");
for (const [version, name] of pending) {
  const sql = body(version, name);
  const result = await query(`begin;
    set local lock_timeout='5s';
    set local statement_timeout='120s';
    select pg_advisory_xact_lock(hashtext('imperio:migration${version}'));
    ${sql}
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array[$migration${version}$${sql}$migration${version}$]);
    commit;
    select true as applied;`);
  assert.equal(result[0]?.applied, true, `${version} apply did not confirm`);
  const recorded = await query(`select version,name from supabase_migrations.schema_migrations where version='${version}'`);
  assert.equal(recorded[0]?.name, name, `${version} was not recorded in migration history`);
  console.log(`Applied ${version}_${name}.sql`);
}

const verified = await query(`select
  (select count(*)=3 from information_schema.columns where table_schema='public' and table_name='marketing_automation_jobs'
    and (column_name in ('contact_email','provider_delivery_confirmed_at') or (column_name='user_id' and is_nullable='YES'))) as jobs_columns,
  (select count(distinct tablename)=6 from pg_tables where schemaname='public' and tablename in ('marketing_email_verifications','marketing_subscription_notices','commerce_delivery_events','post_delivery_jobs','email_provider_events','communication_mailboxes')) as six_tables,
  exists(select 1 from pg_tables where schemaname='public' and tablename='communication_inbound_messages') as inbound_table,
  (select count(distinct viewname)=4 from pg_views where schemaname='public' and viewname in ('marketing_email_contacts','admin_communication_records','admin_audience_contacts','admin_email_funnel_contacts')) as four_views,
  (select count(distinct viewname)=5 from pg_views where schemaname='public' and viewname in ('admin_communication_source_records','admin_communication_coverage','admin_audience_sources','admin_audience_totals','admin_audience_timeline')) as communications_views,
  (select count(*)=4 from information_schema.columns where table_schema='public' and table_name='commerce_orders'
    and column_name in ('carrier_delivered_at','customer_received_at','post_delivery_stage','next_email_at')) as order_columns,
  (select count(*)=7 from information_schema.columns where table_schema='public' and table_name='stripe_webhook_events'
    and column_name in ('occurred_at','customer_email','amount_paid','currency','subscription_id','invoice_id','billing_reason')) as webhook_columns,
  (select bool_and(to_regprocedure(signature) is not null) from unnest(array[
    'public.confirm_marketing_email(uuid,text)',
    'public.claim_contact_welcome()',
    'public.queue_contact_welcome(text,text,timestamp with time zone,integer,text)',
    'public.record_commerce_delivery(uuid,text,integer,integer,timestamp with time zone,text,uuid,text,uuid)',
    'public.queue_post_delivery_jobs(timestamp with time zone,integer,integer,boolean)',
    'public.confirm_commerce_receipt(uuid,uuid,timestamp with time zone,uuid,text,integer,integer,uuid)',
    'public.commit_mailbox_read_batch(jsonb)',
    'public.record_commerce_dispute(text,text,timestamp with time zone)'
  ]) as expected(signature)) as eight_functions,
  to_regprocedure('public.prune_communications_data()') is not null as prune_function,
  to_regprocedure('public.email_funnel_step_kind(text,jsonb)') is not null as funnel_step_function`);
assert.equal(verified.length, 1);
for (const [check, value] of Object.entries(verified[0])) assert.equal(value, true, `verification failed: ${check}`);
const runtimeAfter = await query("select enabled, enrollment_starts_at::text, template_digest from public.marketing_automation_runtime where id=true");
assert.deepEqual(runtimeAfter, runtimeBefore, "marketing runtime flags must not change during migration");
console.log(JSON.stringify({ verified: true, ...verified[0] }));
