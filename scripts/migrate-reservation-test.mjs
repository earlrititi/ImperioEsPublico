import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";

const cli = resolve(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js");
const env = parseEnv(readFileSync('.env.reservation-test.local','utf8'));
const ref = env.SUPABASE_TEST_PROJECT_REF;
if (ref !== 'joicpkgvggfxzrdazisx') throw new Error('Only the verified ImperioE Test project is allowed');
const dir = mkdtempSync(join(tmpdir(),'imperio-test-migrate-'));
const run = (sql) => {
  const file = join(dir,'query.sql');
  writeFileSync(file,sql);
  const output = execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref',ref,'--file',file,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return JSON.parse(output);
};
run('create schema if not exists private; create table if not exists private.test_applied_migrations(name text primary key, checksum text not null)');
const appliedResult = run('select name, checksum from private.test_applied_migrations');
const applied = Array.isArray(appliedResult) ? appliedResult : appliedResult.rows;
if (!Array.isArray(applied)) throw new Error('Unexpected CLI response');
for (const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) {
  const sql = readFileSync(join('supabase/migrations',name),'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const previous = applied.find(m=>m.name===name);
  if (previous) { if (previous.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`); continue; }
  run(`begin; ${sql}\ninsert into private.test_applied_migrations values('${name}','${checksum}'); commit;`);
  console.log(`Applied ${name} to ImperioE Test`);
}
console.log('Production link unchanged. Test migrations complete.');
