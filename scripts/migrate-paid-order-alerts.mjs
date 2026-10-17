import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { mode: { type: 'string' }, workdir: { type: 'string' }, apply: { type: 'boolean' } } });
assert.ok(['test', 'live'].includes(values.mode));
const ref = values.mode === 'test' ? 'joicpkgvggfxzrdazisx' : 'pjrqozlyrjgugdraoght';
const workdir = resolve(values.workdir ?? '.');
assert.equal(readFileSync(join(workdir, 'supabase/.temp/project-ref'), 'utf8').trim(), ref, 'Wrong linked SQL workspace');
const cli = join(process.env.LOCALAPPDATA, 'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file = join(mkdtempSync(join(tmpdir(), 'imperio-paid-notice-')), 'migration.sql');
function query(sql) {
  writeFileSync(file, sql);
  try {
    const data = JSON.parse(execFileSync(process.execPath, [cli, 'db', 'query', '--linked', '--project-ref', ref,
      '--workdir', workdir, '--file', file, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }));
    return data.rows ?? data;
  } catch { throw Error('Paid-order notice SQL failed; transaction rolled back. Private diagnostics omitted.'); }
}
const name = '033_paid_order_admin_alerts.sql', sql = readFileSync(join('supabase/migrations', name), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const exists = query("select to_regclass('public.paid_order_admin_outbox') is not null as applied")[0].applied;
console.log(JSON.stringify({ mode: values.mode, project: ref, migration: name, alreadyApplied: exists, apply: !!values.apply }));
if (exists || !values.apply) process.exit(0);
const backup = query("select pg_get_functiondef(to_regprocedure('private.dispatch_commerce_maintenance()')) as scheduler");
mkdirSync('tmp/paid-order-alerts', { recursive: true });
writeFileSync(`tmp/paid-order-alerts/${values.mode}-scheduler-before.json`, JSON.stringify(backup), { mode: 0o600 });
const ledger = values.mode === 'test'
  ? `insert into private.test_applied_migrations(name,checksum) values('${name}','${checksum}');`
  : `insert into supabase_migrations.schema_migrations(version,name,statements) values('033','paid_order_admin_alerts',array[$paid_notice_migration$${sql}$paid_notice_migration$]);`;
query(`begin; set local lock_timeout='5s'; ${sql}\n${ledger}\ncommit; select true as applied;`);
console.log(JSON.stringify({ applied: true, newQueue: query('select count(*)::integer as count from public.paid_order_admin_outbox')[0].count,
  paymentsCreated: false, customerMailRequeued: false, stockChanged: false }));
