import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Resend } from 'resend';

const env = parseEnv(readFileSync('.env.reservation-production.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://pjrqozlyrjgugdraoght.supabase.co');
const cli = join(process.env.LOCALAPPDATA, 'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const sql = `select jsonb_build_object(
 'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name)) from supabase_migrations.schema_migrations),
 'products',(select coalesce(jsonb_agg(p),'[]') from public.products p),
 'variants',(select coalesce(jsonb_agg(v),'[]') from public.product_variants v),
 'prices',(select coalesce(jsonb_agg(p),'[]') from public.product_prices p),
 'composition',(select coalesce(jsonb_agg(c),'[]') from public.product_composition c),
 'profile_privileges',(select jsonb_agg(g) from information_schema.role_table_grants g where table_schema='public' and table_name='profiles'),
 'subscriptions_count',(select count(*) from public.subscriptions),
 'contact_user_count',(select count(*) from auth.users where lower(email)='contacto@imperioes.com'),
 'contact_admin_count',(select count(*) from auth.users where lower(email)='contacto@imperioes.com' and raw_app_meta_data->>'commerce_admin'='true'),
 'reservations_exist',to_regclass('public.reservations') is not null
) as snapshot`;
const output = execFileSync(process.execPath, [cli, 'db', 'query', '--linked', '--project-ref', 'pjrqozlyrjgugdraoght', sql, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], windowsHide: true });
const result = JSON.parse(output), data = (result.rows ?? result)[0].snapshot;
mkdirSync('.codex-reservation-release', { recursive: true });
const path = `.codex-reservation-release/catalog-before-${Date.now()}.json`;
writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ backup: path, migrations: data.migrations, catalog: { products: data.products.length, variants: data.variants.length, prices: data.prices.length }, subscriptions: data.subscriptions_count, contactUsers: data.contact_user_count, contactAdmins: data.contact_admin_count, reservationsExist: data.reservations_exist }));
console.log(JSON.stringify({ configuration: Object.fromEntries(['PUBLIC_SITE_URL','RESERVATION_MODE','SHIRT_SALES_APPROVED','STRIPE_LIVE_CHECKOUT_ENABLED','COMMERCE_EMAIL_MODE','RESEND_FROM_EMAIL','MANIFESTO_FROM_EMAIL'].map(k=>[k, env[k] ?? '(unset)'])), credentialsPresent: Object.fromEntries(['SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'].map(k=>[k, Boolean(env[k])])) }));
if (env.RESEND_API_KEY) {
  const result = await new Resend(env.RESEND_API_KEY).domains.list();
  console.log(JSON.stringify({ resend: result.error ? { error: result.error.name } : result.data.data.map(d=>({name:d.name,status:d.status,id:d.id})) }));
}
