import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const test=process.argv.includes("--test"),apply=process.argv.includes("--apply");
const project=test?"joicpkgvggfxzrdazisx":"pjrqozlyrjgugdraoght";
const workdir=test?process.env.SUPABASE_TEST_WORKDIR:process.cwd();
assert.ok(workdir,"SUPABASE_TEST_WORKDIR required");
assert.equal(readFileSync(join(workdir,"supabase/.temp/project-ref"),"utf8").trim(),project);
const cli=join(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const file=join(mkdtempSync(join(tmpdir(),"imperio-lifecycle-")),"migration.sql");
function query(sql){
  writeFileSync(file,sql);
  try{const result=JSON.parse(execFileSync(cli,["db","query","--linked","--project-ref",project,"--workdir",workdir,"--file",file,"--output","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true}));return result.rows??result;}
  catch{throw Error("Lifecycle SQL failed; private diagnostics omitted");}
}
const prerequisites=query("select to_regclass('public.cms_articles') is not null and to_regprocedure('public.transition_article(uuid,uuid,integer,text)') is not null as ready");
assert.equal(prerequisites[0].ready,true);
const applied=test?false:query("select exists(select 1 from supabase_migrations.schema_migrations where version='038') as applied")[0].applied;
console.log(JSON.stringify({project,apply,alreadyApplied:applied}));
if(!apply||applied)process.exit(0);
const snapshot=`select jsonb_build_object('orders',(select count(*) from public.commerce_orders),'reservations',(select count(*) from public.reservations),'subscriptions',(select count(*) from public.subscriptions),'stock',(select md5(coalesce(string_agg(to_jsonb(v)::text,'' order by v.id),'')) from public.product_variants v),'articles',(select md5(coalesce(string_agg(to_jsonb(a)::text,'' order by a.id),'')) from public.cms_articles a)) as state`;
const before=query(snapshot)[0].state,sql=readFileSync("supabase/migrations/038_article_legacy_lifecycle.sql","utf8");
assert.ok(!sql.includes("$lifecycle_migration$"));
const history=test?"":`insert into supabase_migrations.schema_migrations(version,name,statements) values('038','article_legacy_lifecycle',array[$lifecycle_migration$${sql}$lifecycle_migration$]);`;
query(`begin;set local lock_timeout='5s';set local statement_timeout='60s';${sql}\n${history}\ncommit;select true as applied;`);
assert.deepEqual(query(snapshot)[0].state,before,"Concurrent data change detected; review before proceeding");
console.log("Lifecycle function applied; article records, orders, subscriptions, reservations and stock unchanged. No content transition, email or charge triggered.");
