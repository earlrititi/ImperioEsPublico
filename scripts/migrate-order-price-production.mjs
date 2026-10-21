import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';

const project = 'pjrqozlyrjgugdraoght';
const env = parseEnv(readFileSync('.env.admin-production.local', 'utf8'));
assert.equal(new URL(env.PUBLIC_SUPABASE_URL).hostname, `${project}.supabase.co`);
const cli = join(process.env.LOCALAPPDATA, 'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file = join(mkdtempSync(join(tmpdir(), 'imperio-migration039-')), 'query.sql');
function query(sql) {
  writeFileSync(file, sql);
  try {
    const output = JSON.parse(execFileSync(process.execPath,
      [cli, 'db', 'query', '--linked', '--project-ref', project, '--file', file, '--output', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }));
    return output.rows ?? output;
  } catch { throw Error('Production migration verification failed. Private database output omitted.'); }
}
const applied = query("select version from supabase_migrations.schema_migrations where version in ('017','033','039')");
assert.ok(applied.some(row => row.version === '017'));
assert.ok(applied.some(row => row.version === '033'));
const alreadyApplied = applied.some(row => row.version === '039');
console.log(JSON.stringify({ project, migration: '039', alreadyApplied, apply: process.argv.includes('--apply') }));
if (!alreadyApplied && process.argv.includes('--apply')) {
  const body = readFileSync('supabase/migrations/039_order_price_breakdown.sql', 'utf8');
  assert.ok(!body.includes('$migration039$'));
  query(`begin;
    set local lock_timeout='5s';
    set local statement_timeout='30s';
    select pg_advisory_xact_lock(hashtext('imperio:migration039'));
    lock table public.commerce_orders in access exclusive mode;
    create temporary table orders_before039 on commit drop as
      select md5(coalesce(jsonb_agg(to_jsonb(o)-'product_subtotal'-'shipping_amount' order by id)::text,'')) as digest
      from public.commerce_orders o;
    ${body}
    do $$ begin
      if (select digest from orders_before039) is distinct from
        (select md5(coalesce(jsonb_agg(to_jsonb(o)-'product_subtotal'-'shipping_amount' order by id)::text,'')) from public.commerce_orders o)
        then raise exception 'HISTORICAL_ORDERS_CHANGED'; end if;
      if exists(select 1 from public.commerce_orders where product_subtotal is not null or shipping_amount is not null)
        then raise exception 'HISTORICAL_BREAKDOWN_CHANGED'; end if;
    end $$;
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values('039','order_price_breakdown',array[$migration039$${body}$migration039$]);
    commit; select true as applied;`);
}
if (alreadyApplied || process.argv.includes('--apply')) {
  const rows = query(`select
    exists(select 1 from supabase_migrations.schema_migrations where version='039' and name='order_price_breakdown') as migration_recorded,
    (select count(*)=2 from information_schema.columns where table_schema='public' and table_name='commerce_orders' and column_name in ('product_subtotal','shipping_amount')) as columns_present,
    exists(select 1 from pg_trigger where tgname='shirt_order_price_breakdown' and tgenabled='O') as trigger_enabled,
    not has_table_privilege('anon','public.product_variants','SELECT') and not has_table_privilege('authenticated','public.product_variants','SELECT') as stock_private;`);
  assert.equal(rows.length, 1);
  assert.ok(Object.values(rows[0]).every(value => value === true));
  console.log(JSON.stringify({ verified: true, ...rows[0] }));
}
