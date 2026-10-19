import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const workdir=process.env.SUPABASE_TEST_WORKDIR;
assert.ok(workdir);
assert.equal(readFileSync(join(workdir,"supabase/.temp/project-ref"),"utf8").trim(),"joicpkgvggfxzrdazisx");
const cli=join(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const file=join(mkdtempSync(join(tmpdir(),"imperio-commercial-test-")),"test.sql");
for(const name of ["035_article_media_and_trash","036_marketing_prospective_activation","032_marketing_automation_worker"]){
  const source=readFileSync(`supabase/tests/${name}.sql`,"utf8");
  writeFileSync(file,name.startsWith("032")?`begin;${source}\nrollback;select true as verified;`:source);
  try{const output=JSON.parse(execFileSync(cli,["db","query","--linked","--project-ref","joicpkgvggfxzrdazisx","--workdir",workdir,"--file",file,"--output","json"],
    {encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true}));assert.equal(output.rows?.[0]?.verified,true);}
  catch(error){if(process.env.COMMERCIAL_TEST_DIAGNOSTICS==="true")console.error(String(error.stderr).slice(-1800));throw Error(`Test SQL failed: ${name}; private output omitted`);}
  console.log(`${name}: Test SQL passed with rollback. No messages or production changes.`);
}
