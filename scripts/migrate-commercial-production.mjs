import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const project="pjrqozlyrjgugdraoght";
assert.equal(readFileSync("supabase/.temp/project-ref","utf8").trim(),project,"Wrong linked production project");
const cli=join(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const file=join(mkdtempSync(join(tmpdir(),"imperio-commercial-production-")),"migration.sql");
function query(sql){
  writeFileSync(file,sql);
  try{const result=JSON.parse(execFileSync(cli,["db","query","--linked","--project-ref",project,"--file",file,"--output","json"],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true}));return result.rows??result;}
  catch{throw Error("Production commercial SQL failed; private diagnostics omitted");}
}
const applied=query("select version from supabase_migrations.schema_migrations order by version");
for(const version of ["018","020","028","029","033"])assert.ok(applied.some(row=>row.version===version),`Missing prerequisite ${version}`);
const names=["030_marketing_automation_drafts.sql","031_targeted_commerce_mail.sql","032_marketing_automation_worker.sql",
  "034_legal_consent_privileges.sql","035_article_media_and_trash.sql","036_marketing_prospective_activation.sql"];
const pending=names.filter(name=>!applied.some(row=>row.version===name.slice(0,3)));
console.log(JSON.stringify({project,pending,apply:process.argv.includes("--apply")}));
if(!process.argv.includes("--apply")||!pending.length)process.exit(0);
const signature=`select jsonb_build_object('orders',(select count(*) from public.commerce_orders),
  'reservations',(select count(*) from public.reservations),'subscriptions',(select count(*) from public.subscriptions),
  'stock',(select md5(coalesce(string_agg(to_jsonb(v)::text,'' order by v.id),'')) from public.product_variants v)) as state`;
const before=query(signature)[0].state;
const statements=pending.map(name=>{
  const sql=readFileSync(join("supabase/migrations",name),"utf8");assert.ok(!sql.includes("$commercial_migration$"));
  return `${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements)
    values('${name.slice(0,3)}','${name.slice(4,-4)}',array[$commercial_migration$${sql}$commercial_migration$]);`;
});
query(`begin;set local lock_timeout='5s';set local statement_timeout='60s';${statements.join("\n")}\ncommit;select true as applied;`);
assert.deepEqual(query(signature)[0].state,before,"Commerce state changed during migration; review concurrent orders");
console.log("Commercial migrations applied atomically. Order, reservation, subscription counts and stock unchanged. No campaigns or payments triggered.");
