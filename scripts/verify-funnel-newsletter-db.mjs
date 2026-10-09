import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
assert.ok(process.env.SUPABASE_TEST_WORKDIR?.includes('imperio-test-link-'));
const sql=`begin;do $$ declare r uuid:=gen_random_uuid();a uuid:=gen_random_uuid();c uuid:=gen_random_uuid();n integer;
begin
 if has_table_privilege('anon','public.funnel_runs','SELECT') or has_table_privilege('authenticated','public.manifesto_requests','SELECT')
 or has_function_privilege('anon','public.record_funnel_step(uuid,text,integer,text)','EXECUTE') then raise exception 'Public private access';end if;
 perform public.record_funnel_step(r,'subscriptions',0,'/suscribirse');perform public.record_funnel_step(r,'subscriptions',0,'/suscribirse');perform public.record_funnel_step(r,'subscriptions',2,'/checkout/arcabucero-annual');
 if (select jsonb_array_length(stages) from public.funnel_runs where id=r)<>2 then raise exception 'Duplicate stages';end if;
 begin perform public.record_funnel_step(r,'subscriptions',4,'/cuenta');raise exception 'Private URL allowed';exception when others then if sqlerrm<>'INVALID_INPUT' then raise;end if;end;
 insert into auth.users(id,email,raw_user_meta_data)values(a,'newsletter-'||a||'@example.invalid','{}');
 n:=public.save_newsletter_draft(c,a,0,'manifesto','{"subject":"Test draft","preheader":"","content":"Test only","cta_label":"","cta_url":""}');
 if n<>1 then raise exception 'Draft revision';end if;
 n:=public.save_newsletter_draft(c,a,1,'leads','{"subject":"Updated test","preheader":"","content":"Test only","cta_label":"","cta_url":""}');
 if n<>2 then raise exception 'Save revision';end if;
 begin perform public.save_newsletter_draft(c,a,1,'leads','{}');raise exception 'Stale write';exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise;end if;end;
 begin perform public.queue_newsletter_revision(c,array['test@example.invalid'],a,1);raise exception 'Stale approval';exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise;end if;end;
 perform public.queue_newsletter_revision(c,array['test@example.invalid'],a,2);
 if not exists(select 1 from public.email_logs where campaign_id=c and status='pending') then raise exception 'Mail not queued';end if;
 if position('public.email_logs' in pg_get_functiondef('private.dispatch_commerce_maintenance()'::regprocedure))=0 then raise exception 'Missing newsletter dispatch';end if;
 begin perform public.save_newsletter_draft(c,a,2,'leads','{}');raise exception 'Editing a sending campaign';exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise;end if;end;
 insert into public.manifesto_requests(id,email,name,source)values(r,'test@example.invalid','Test only','test');
 if (select marketing_consent from public.manifesto_requests where id=r) then raise exception 'Marketing opted in by default';end if;
end $$;rollback;select true as test_passed;`;
const file=join(mkdtempSync(join(tmpdir(),'imperio-funnel-test-')),'test.sql');writeFileSync(file,sql);
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const result=JSON.parse(execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','joicpkgvggfxzrdazisx','--workdir',process.env.SUPABASE_TEST_WORKDIR,'--file',file,'--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}));
assert.equal((result.rows??result)[0].test_passed,true);console.log('Funnel deduplication, grants, newsletter revisions/queue and default opt-out passed in Test. All fixtures rolled back. No emails.');
