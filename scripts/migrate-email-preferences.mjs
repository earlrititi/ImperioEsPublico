import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdtempSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
const test=process.argv.includes("--test"),apply=process.argv.includes("--apply");
const project=test?"joicpkgvggfxzrdazisx":"pjrqozlyrjgugdraoght";
const workdir=test?process.env.SUPABASE_TEST_WORKDIR:process.cwd();assert.ok(workdir);
assert.equal(readFileSync(join(workdir,"supabase/.temp/project-ref"),"utf8").trim(),project);
const cli=join(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const file=join(mkdtempSync(join(tmpdir(),"imperio-email-migration-")),"migration.sql");
function query(sql){writeFileSync(file,sql);try{const data=JSON.parse(execFileSync(cli,["db","query","--linked","--project-ref",project,"--workdir",workdir,"--file",file,"--output","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true}));return data.rows??data;}
catch(error){throw Error(String(error.stderr??"").match(/ERROR:[^\r\n]+/)?.[0]??"Preference migration failed; private diagnostics omitted");}}
assert.equal(query("select to_regclass('public.marketing_automation_enrolled_subjects') is not null as ready")[0].ready,true);
const applied=query("select to_regclass('public.account_email_preferences') is not null as applied")[0].applied;
console.log(JSON.stringify({project,apply,alreadyApplied:applied}));if(!apply)process.exit(0);
if(applied){
  if(test){const functions=readFileSync("supabase/migrations/040_email_marketing_preferences.sql","utf8").match(/create or replace function public\.(?:get_account_email_preference|set_account_email_preference|suppress_marketing_email)[\s\S]*?end \$\$;/g)?.join("\n");assert.ok(functions);
    query(`begin;set local lock_timeout='5s';${functions}\ncommit;select true as refreshed;`);console.log("Test-only preference functions refreshed; no data changed.");}
  process.exit(0);
}
const snapshot=`select jsonb_build_object('orders',(select count(*) from public.commerce_orders),'subscriptions',(select count(*) from public.subscriptions),'reservations',(select count(*) from public.reservations),'stock',(select md5(coalesce(string_agg(to_jsonb(v)::text,'' order by v.id),'')) from public.product_variants v),'articles',(select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by a.id),'')) from public.cms_articles a),'runtime',(select to_jsonb(r) from public.marketing_automation_runtime r),'jobs',(select count(*) from public.marketing_automation_jobs),'enrolled',(select count(*) from public.marketing_automation_enrolled_subjects)) as state`;
const before=query(snapshot)[0].state,sql=readFileSync("supabase/migrations/040_email_marketing_preferences.sql","utf8");
assert.ok(!sql.includes("$email_migration$"));
const history=test?"":`insert into supabase_migrations.schema_migrations(version,name,statements) values('040','email_marketing_preferences',array[$email_migration$${sql}$email_migration$]);`;
query(`begin;set local lock_timeout='5s';set local statement_timeout='60s';${sql}\n${history}\ncommit;select true as applied;`);
assert.deepEqual(query(snapshot)[0].state,before,"Concurrent state change; review before publication");
assert.equal(query("select count(*)=0 as empty from public.account_email_preferences")[0].empty,true);
console.log("Migration 040 applied. Financial records, stock, articles, automation flags/cutoff, queue and enrolled count unchanged. No historical enrollment, email or charge.");
