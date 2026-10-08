import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseEnv } from 'node:util';
const env = parseEnv(readFileSync('.env.reservation-test.local','utf8'));
if (env.SUPABASE_TEST_PROJECT_REF !== 'joicpkgvggfxzrdazisx') throw new Error('Test project required');
const cli = join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file = join(mkdtempSync(join(tmpdir(),'imperio-admin-test-')),'assertions.sql');
const sql = `begin;
do $$
declare a public.subscription_checkouts; b public.subscription_checkouts; before_summary jsonb; after_summary jsonb; v_email text; identity uuid:=gen_random_uuid(); table_name text;
  actor uuid:=gen_random_uuid(); mail_id uuid:=gen_random_uuid(); job public.email_logs;
  article_id uuid:=gen_random_uuid(); article public.cms_articles; draft jsonb;
  mail jsonb:='{"subject":"Test","preheader":"Test","content":"Test","cta_label":"","cta_url":""}';
begin
  foreach table_name in array array['site_interactions','cms_articles','newsletter_campaigns','email_logs','email_suppressions','subscription_checkouts'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||table_name)::regclass) then raise exception 'Missing RLS: %',table_name; end if;
    if has_table_privilege('anon','public.'||table_name,'SELECT') or has_table_privilege('authenticated','public.'||table_name,'SELECT') then raise exception 'Public table access: %',table_name; end if;
  end loop;
  if has_function_privilege('anon','public.claim_subscription_checkout(text,text,uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.admin_analytics_summary(integer)','EXECUTE')
    or has_function_privilege('anon','public.queue_newsletter(uuid,text[],uuid)','EXECUTE')
    then raise exception 'Public privileged RPC access'; end if;
  v_email:='guard-'||gen_random_uuid()||'@example.invalid';
  a:=public.claim_subscription_checkout(v_email,'arcabucero',null,'{"mode":"subscription","metadata":{"revision":"original"}}');
  b:=public.claim_subscription_checkout(upper(v_email),'arcabucero',null,'{"mode":"subscription","metadata":{"revision":"retry"}}');
  if a.attempt_id<>b.attempt_id or b.parameters->'metadata'->>'revision'<>'original' then raise exception 'Retry changed immutable checkout'; end if;
  begin
    perform public.claim_subscription_checkout(v_email,'maestre_campo',null,'{}');
    raise exception 'Different plan bypassed checkout guard';
  exception when others then if sqlerrm <> 'CHECKOUT_ALREADY_OPEN' then raise; end if; end;
  update public.subscription_checkouts set expires_at=now()-interval '3 minutes' where subscription_checkouts.email=v_email;
  b:=public.claim_subscription_checkout(v_email,'maestre_campo',null,'{"mode":"subscription"}');
  if a.attempt_id=b.attempt_id or b.plan<>'maestre_campo' then raise exception 'Expired guard was not replaced'; end if;
  before_summary:=public.admin_analytics_summary(30);
  insert into public.legal_consents(anonymous_id,consent_type,document_version,accepted,source,created_at) values
    (identity,'cookies_analytics','test',false,'cookie_banner',now()-interval '3 minutes'),
    (identity,'cookies_analytics','test',true,'cookie_settings',now()-interval '2 minutes'),
    (identity,'cookies_analytics','test',false,'cookie_settings',now()-interval '1 minute');
  after_summary:=public.admin_analytics_summary(30);
  if (select (v->>'withdrawals')::int from jsonb_array_elements(after_summary->'consents') v where v->>'consent_type'='cookies_analytics')
    <> coalesce((select (v->>'withdrawals')::int from jsonb_array_elements(before_summary->'consents') v where v->>'consent_type'='cookies_analytics'),0)+1 then raise exception 'Initial rejection counted as withdrawal'; end if;
  perform public.record_site_interaction('/test-admin-database','page','page_view');
  perform public.record_site_interaction('/test-admin-database','page','page_view');
  if (select count from public.site_interactions where page='/test-admin-database')<>2 then raise exception 'Aggregation failed'; end if;
  insert into auth.users(id,email) values(actor,'admin-test-'||actor||'@example.invalid');
  if has_function_privilege('anon','public.save_article_draft(uuid,uuid,integer,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.save_article_draft(uuid,uuid,integer,jsonb)','EXECUTE') then raise exception 'Public CMS mutation'; end if;
  draft:=jsonb_build_object('slug','test-'||article_id,'title','Draft test','body','<p>private draft</p>');
  article:=public.save_article_draft(article_id,actor,0,draft);
  article:=public.save_article_draft(article_id,actor,0,draft);
  if article.revision<>1 or article.status<>'draft' or article.published_body is not null then raise exception 'Draft creation/retry failed'; end if;
  article:=public.save_article_draft(article_id,actor,1,draft||'{"title":"Edited"}');
  if article.revision<>2 then raise exception 'Draft revision not incremented'; end if;
  begin
    perform public.save_article_draft(article_id,actor,1,draft);
    raise exception 'Stale revision overwrote article';
  exception when others then if sqlerrm<>'ARTICLE_CONFLICT' then raise; end if; end;
  begin
    perform public.save_article_draft(gen_random_uuid(),actor,0,draft);
    raise exception 'Duplicate slug accepted';
  exception when others then if sqlerrm<>'ARTICLE_SLUG_EXISTS' then raise; end if; end;
  update public.cms_articles set published_meta='{}',published_body='public snapshot',status='published' where id=article_id;
  article:=public.save_article_draft(article_id,actor,2,draft||'{"body":"unpublished changes"}');
  if article.published_body<>'public snapshot' then raise exception 'Draft edit changed published body'; end if;
  begin
    perform public.save_article_draft(article_id,actor,3,draft||'{"slug":"changed-slug"}');
    raise exception 'Published URL changed';
  exception when others then if sqlerrm<>'ARTICLE_SLUG_LOCKED' then raise; end if; end;
  if (select count(*) from public.commerce_audit where entity='article' and entity_id=article_id)<>3 then raise exception 'Article audit missing/duplicated'; end if;
  perform public.queue_individual_mail(mail_id,actor,'recipient@example.invalid','test',mail);
  perform public.queue_individual_mail(mail_id,actor,'recipient@example.invalid','test',mail);
  if (select count(*) from public.email_logs where id=mail_id)<>1 then raise exception 'Individual email retry duplicated'; end if;
  begin
    perform public.queue_individual_mail(mail_id,actor,'other@example.invalid','test',mail);
    raise exception 'Conflicting email request accepted';
  exception when others then if sqlerrm <> 'REQUEST_CONFLICT' then raise; end if; end;
  -- Isolate the claim assertion inside this rolled-back transaction; no provider is called.
  update public.email_logs set status='sent' where id<>mail_id;
  select * into job from public.claim_admin_mail();
  if job.id is distinct from mail_id then raise exception 'Mail claim failed'; end if;
  if exists(select 1 from public.claim_admin_mail()) then raise exception 'Mail lease claimed twice'; end if;
  perform public.finish_admin_mail(mail_id,job.claim_id,'sent','test_provider_id',null);
  if not exists(select 1 from public.email_logs where id=mail_id and delivery_status='accepted_by_provider') then raise exception 'Mail receipt missing'; end if;
end $$;
rollback;
select true as passed, 'RLS, RPC grants, checkout retries/expiry, consent transitions, aggregation, mail idempotency and leases; fixtures rolled back' as checks;`;
writeFileSync(file,sql);
try {
  const args=[cli,'db','query','--linked','--project-ref',env.SUPABASE_TEST_PROJECT_REF,'--file',file,'--output','json'];
  if(process.env.SUPABASE_TEST_WORKDIR) args.push('--workdir',process.env.SUPABASE_TEST_WORKDIR);
  const out=execFileSync(process.execPath,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true});
  console.log(out);
} catch(error) {
  console.error('Test database assertions failed:',String(error.stderr).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));
  process.exitCode=1;
}
