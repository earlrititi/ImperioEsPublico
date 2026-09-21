import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import assert from 'node:assert/strict';
const env=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
assert.equal(env.RESERVATION_MODE,'true');assert.equal(env.SHIRT_SALES_APPROVED,'false');
assert.equal(env.STRIPE_LIVE_CHECKOUT_ENABLED,'false');
const backups=readdirSync('.codex-reservation-release').filter(n=>n.startsWith('catalog-before-'));
assert.ok(backups.length,'Back up affected production catalog first');
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const query=sql=>{
 const path='.codex-reservation-release/migrate.sql';writeFileSync(path,sql);
 const out=JSON.parse(execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','pjrqozlyrjgugdraoght','--file',path,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));return out.rows??out;
};
try {
 const applied=query('select version from supabase_migrations.schema_migrations');
 for(const v of ['001','002','003','004','005','006','007','008'])assert.ok(applied.some(a=>a.version===v),`Missing prerequisite ${v}`);
 const pending=readdirSync('supabase/migrations').filter(n=>/^0(09|1[0-5])_.*\.sql$/.test(n)&&!applied.some(a=>a.version===n.slice(0,3))).sort();
 console.log(JSON.stringify({project:'pjrqozlyrjgugdraoght',pending,apply:process.argv.includes('--apply')}));
 if(process.argv.includes('--apply')&&pending.length){
   const snapshot=query(`select jsonb_build_object(
     'reservations',(select coalesce(jsonb_agg(r),'[]') from public.reservations r),
     'reservation_items',(select coalesce(jsonb_agg(r),'[]') from public.reservation_items r),
     'orders',(select coalesce(jsonb_agg(r),'[]') from public.commerce_orders r),
     'variants',(select coalesce(jsonb_agg(r),'[]') from public.product_variants r),
     'functions',(select jsonb_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%shirt%')
   ) as snapshot`);
   writeFileSync(`.codex-reservation-release/commerce-before-migration-${Date.now()}.json`,JSON.stringify(snapshot),{mode:0o600});
   const sql=pending.map(name=>{
     const body=readFileSync(join('supabase/migrations',name),'utf8');
     const label=name.replace(/^\d+_/,'').replace(/\.sql$/,'');
     return `${body}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('${name.slice(0,3)}','${label}',array[$migration_body$${body}$migration_body$]);`;
   }).join('\n');
   query(`begin; set local lock_timeout='5s'; ${sql}\ncommit; select true as applied;`);
   console.log('Reservation migrations committed atomically. Existing subscriptions untouched.');
 }
}catch(error){console.error(JSON.stringify({migrationFailed:true,code:error.code??error.name,reason:error instanceof assert.AssertionError?error.message:'SQL failed; transaction rolled back; inspect private diagnostic locally'}));process.exitCode=1;}
