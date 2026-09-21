import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const env=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(env.PUBLIC_SITE_URL,'https://imperioes.com');assert.equal(env.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
assert.match(env.COMMERCE_JOB_SECRET,/^[a-f0-9]{64}$/);
if(!process.argv.includes('--apply')){console.log('Plan: Supabase Cron every five minutes, conditional POST to commerce maintenance, credential in Vault. No changes.');process.exit(0);}
const sql=`begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $block$ declare secret_id uuid; begin
 select id into secret_id from vault.secrets where name='imperio_commerce_job_secret';
 if secret_id is null then perform vault.create_secret('${env.COMMERCE_JOB_SECRET}','imperio_commerce_job_secret');
 else perform vault.update_secret(secret_id,'${env.COMMERCE_JOB_SECRET}'); end if;
end $block$;
create or replace function private.dispatch_commerce_maintenance() returns bigint
language plpgsql security definer set search_path='' as $function$
declare request_id bigint; secret text;
begin
 if not exists(select 1 from public.commerce_outbox where status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
 and not exists(select 1 from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_FAILED','PAYMENT_PENDING') and expires_at<=now())
 and not exists(select 1 from public.commerce_campaign c where c.purchase_activated and (c.purchase_open_at is null or c.purchase_open_at<=now())
   and exists(select 1 from public.reservations where status='RESERVED')) then return null; end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='imperio_commerce_job_secret';
 if secret is null then raise exception 'MAINTENANCE_SECRET_MISSING'; end if;
 select net.http_post(url:='https://imperioes.com/api/commerce-maintenance',headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=30000) into request_id;
 return request_id;
end $function$;
revoke all on function private.dispatch_commerce_maintenance() from public,anon,authenticated;
select cron.schedule('imperio-commerce-maintenance','*/5 * * * *','select private.dispatch_commerce_maintenance()');
commit;
select jobname,schedule,active from cron.job where jobname='imperio-commerce-maintenance';`;
const file='.codex-reservation-release/schedule.sql';writeFileSync(file,sql,{mode:0o600});
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
try{
 const out=JSON.parse(execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','pjrqozlyrjgugdraoght','--file',file,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));
 console.log(JSON.stringify({productionJob:out.rows??out,secretStored:'Vault',externalPaidServicesAdded:false}));
}catch{console.error('Production scheduler setup failed; no credentials printed.');process.exitCode=1;}
