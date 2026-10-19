import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
const env = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
const workdir = process.env.SUPABASE_TEST_WORKDIR;
assert.ok(workdir);
assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), 'joicpkgvggfxzrdazisx');
const cli = join(process.env.LOCALAPPDATA, 'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file = join(mkdtempSync(join(tmpdir(), 'imperio-automation-db-')), 'test.sql');
const query = sql => {
  writeFileSync(file, sql);
  try {
    const result = JSON.parse(execFileSync(process.execPath, [cli, 'db', 'query', '--linked', '--project-ref', 'joicpkgvggfxzrdazisx', '--workdir', workdir,
      '--file', file, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }));
    return result.rows ?? result;
  } catch (error) {
    if (process.env.AUTOMATION_SQL_DIAGNOSTICS === 'true') console.error(String(error.stderr).match(/ERROR:.*?(?=\\n|"\})/s)?.[0]?.slice(0, 240));
    throw error;
  }
};
const exists = query("select to_regclass('public.marketing_automation_runtime') is not null as applied")[0].applied;
const migration = exists ? '' : readFileSync('supabase/migrations/032_marketing_automation_worker.sql', 'utf8');
const tests = readFileSync('supabase/tests/032_marketing_automation_worker.sql', 'utf8');
try { query(`begin;${migration}\n${tests}\nrollback;select true as verified;`); }
catch { throw Error('Automation SQL assertions failed; transaction rolled back. Private diagnostics omitted.'); }
console.log('Automation Test SQL passed: verified identity, separate consents, disabled migration, deduplication, leases, empty cart, withdrawals, suppression, payment cancellation and owner notices. No email; fixtures rolled back.');
