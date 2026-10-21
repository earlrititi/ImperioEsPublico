import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const workdir=process.env.SUPABASE_TEST_WORKDIR;
assert.ok(workdir);assert.equal(readFileSync(join(workdir,"supabase/.temp/project-ref"),"utf8").trim(),"joicpkgvggfxzrdazisx");
const cli=join(process.env.LOCALAPPDATA,"npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe");
const file=join(mkdtempSync(join(tmpdir(),"imperio-email-test-")),"test.sql");
writeFileSync(file,"select to_regclass('public.account_email_preferences') is not null as applied");
const preflight=JSON.parse(execFileSync(cli,["db","query","--linked","--project-ref","joicpkgvggfxzrdazisx","--workdir",workdir,"--file",file,"--output","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"],windowsHide:true}));
const applied=(preflight.rows??preflight)[0].applied;
const migration=readFileSync("supabase/migrations/040_email_marketing_preferences.sql","utf8");
const functions=migration.match(/create or replace function public\.(?:get_account_email_preference|set_account_email_preference|suppress_marketing_email)[\s\S]*?end \$\$;/g)?.join("\n");assert.ok(functions);
writeFileSync(file,`begin;set local statement_timeout='60s';
${applied?functions:migration}
do $$ declare actor uuid:=gen_random_uuid(); unverified uuid:=gen_random_uuid(); addr text; state jsonb; cid uuid; n integer; jid uuid:=gen_random_uuid();
begin
  if has_function_privilege('anon','public.set_account_email_preference(uuid,boolean,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.get_account_email_preference(uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.marketing_suppressed_contacts','SELECT')
    or has_table_privilege('anon','public.account_email_preferences','SELECT') then raise exception 'Public preference access';end if;
  addr:='preference-'||actor||'@example.invalid';
  insert into auth.users(id,email,email_confirmed_at,created_at) values(actor,addr,now(),now()-interval '1 year'),(unverified,'unverified-'||unverified||'@example.invalid',null,now());
  insert into public.profiles(id,email) values(actor,addr) on conflict(id) do update set email=excluded.email;
  if (public.get_account_email_preference(actor)->>'active')::boolean then raise exception 'Implied consent';end if;
  begin perform public.set_account_email_preference(unverified,true,'2026-10-21','2026-10-21','Explicit consent fixture');raise exception 'Unverified opted in';exception when others then if sqlerrm<>'UNAUTHORIZED' then raise;end if;end;
  begin perform public.set_account_email_preference(actor,true,null,'2026-10-21','Explicit consent fixture');raise exception 'Null version accepted';exception when others then if sqlerrm<>'INVALID_INPUT' then raise;end if;end;
  state:=public.set_account_email_preference(actor,true,'2026-10-21','2026-10-21','Explicit consent fixture');
  if not (state->>'active')::boolean or not exists(select 1 from public.marketing_automation_subjects where user_id=actor) then raise exception 'Explicit consent missing';end if;
  select consent_id into cid from public.account_email_preferences where user_id=actor;
  perform public.set_account_email_preference(actor,true,'2026-10-21','2026-10-21','Explicit consent fixture');
  if (select count(*) from public.legal_consents where user_id=actor and consent_type='marketing_email')<>1 then raise exception 'Retry duplicated proof';end if;
  insert into public.marketing_automation_jobs(id,user_id,consent_id,key,step,anchor,due_at,revision,template_digest)values(jid,actor,cid,'welcome','fixture',now(),now(),1,repeat('a',64));
  perform public.set_account_email_preference(actor,false,'2026-10-21','2026-10-21','Explicit consent fixture');
  if not exists(select 1 from public.email_suppressions where email=addr and reason='unsubscribe') then raise exception 'Withdrawal would be lost after account removal';end if;
  if (public.get_account_email_preference(actor)->>'active')::boolean or (select status from public.marketing_automation_jobs where id=jid)<>'suppressed' then raise exception 'Withdrawal did not stop queue';end if;
  if exists(select 1 from public.marketing_automation_subjects where user_id=actor) then raise exception 'Withdrawn automation subject';end if;
  perform public.set_account_email_preference(actor,true,'2026-10-21','2026-10-21','Explicit consent fixture');
  if not (public.get_account_email_preference(actor)->>'active')::boolean then raise exception 'Verified fresh opt in failed';end if;
  if not exists(select 1 from public.legal_consents where user_id=actor and not accepted) then raise exception 'Withdrawal proof erased';end if;
  perform public.suppress_marketing_email(addr,'unsubscribe');
  if (public.get_account_email_preference(actor)->>'active')::boolean then raise exception 'Later unsubscribe ignored';end if;
  perform public.set_account_email_preference(actor,true,'2026-10-21','2026-10-21','Explicit consent fixture');
  if not (public.get_account_email_preference(actor)->>'active')::boolean then raise exception 'Explicit owner reconsent failed';end if;
  perform public.suppress_marketing_email(addr,'provider_bounced');perform public.suppress_marketing_email(addr,'unsubscribe');
  if (select reason from public.email_suppressions where email=addr)<>'provider_bounced' then raise exception 'Hard suppression downgraded';end if;
  begin perform public.set_account_email_preference(actor,true,'2026-10-21','2026-10-21','Explicit consent fixture');raise exception 'Bounce reactivated';exception when others then if sqlerrm<>'EMAIL_BLOCKED' then raise;end if;end;
  perform public.suppress_marketing_email(addr,'provider_complained');
  if (select reason from public.email_suppressions where email=addr)<>'provider_complained' then raise exception 'Complaint lost';end if;
  perform public.record_funnel_step(gen_random_uuid(),'newsletter',4,'/newsletter');
  begin perform public.record_funnel_step(gen_random_uuid(),'newsletter',4,'/newsletter?email=private');raise exception 'Private funnel URL';exception when others then if sqlerrm<>'INVALID_INPUT' then raise;end if;end;
end $$;rollback;select true as verified;`);
try{execFileSync(cli,["db","query","--linked","--project-ref","joicpkgvggfxzrdazisx","--workdir",workdir,"--file",file,"--output","json"],{stdio:["ignore","pipe","pipe"],windowsHide:true});}
catch(error){const detail=String(error.stderr??"").match(/ERROR:[^\r\n]+/)?.[0];throw Error(detail??"Preference SQL test failed; private diagnostics omitted");}
console.log("Preference SQL: explicit consent, unverified refusal, audit/idempotency, withdrawal, queue cancellation, owner reconsent, bounce/complaint permanence, funnel privacy and service-only access passed. All fixtures and migration rolled back; no email or charge.");
