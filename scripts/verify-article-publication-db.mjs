import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file=join(mkdtempSync(join(tmpdir(),'imperio-publish-test-')),'test.sql');
writeFileSync(file,`begin;
do $$ declare actor uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); a public.cms_articles; d jsonb;
begin
  if has_function_privilege('anon','public.transition_article(uuid,uuid,integer,text)','EXECUTE') or
    has_function_privilege('authenticated','public.import_article_draft(uuid,uuid,jsonb)','EXECUTE') then raise exception 'Public mutation'; end if;
  insert into auth.users(id,email) values(actor,'cms-test-'||actor||'@example.invalid');
  d:=jsonb_build_object('slug','cms-'||aid,'title','Title','body','<p>Original private body</p>','publishedAt','2026-10-08');
  a:=public.save_article_draft(aid,actor,0,d);
  a:=public.transition_article(aid,actor,a.revision,'publish');
  if a.status<>'published' or a.published_meta ? 'body' then raise exception 'Publication metadata leak'; end if;
  a:=public.save_article_draft(aid,actor,a.revision,d||'{"body":"<p>Changed draft</p>"}'::jsonb);
  if a.published_body<>'<p>Original private body</p>' then raise exception 'Draft changed public body'; end if;
  begin perform public.transition_article(aid,actor,a.revision-1,'publish');raise exception 'Stale publication allowed';
    exception when others then if sqlerrm<>'ARTICLE_CONFLICT' then raise; end if;end;
  a:=public.transition_article(aid,actor,a.revision,'publish');
  if a.published_body<>'<p>Changed draft</p>' then raise exception 'Publication did not update';end if;
  begin perform public.transition_article(aid,actor,a.revision,'delete');raise exception 'Published delete allowed';
    exception when others then if sqlerrm<>'INVALID_STATE' then raise;end if;end;
  a:=public.transition_article(aid,actor,a.revision,'withdraw');
  if a.status<>'withdrawn' then raise exception 'Withdrawal failed';end if;
  a:=public.transition_article(aid,actor,a.revision,'delete');
  if a.status<>'deleted' then raise exception 'Delete failed';end if;
  aid:=gen_random_uuid();d:=jsonb_build_object('slug','import-'||aid,'title','Legacy','body','<p>Legacy</p>');
  a:=public.import_article_draft(aid,actor,d);
  if a.published_meta is not null or a.legacy_slug<>a.slug then raise exception 'Import changed publication';end if;
  if (public.import_article_draft(gen_random_uuid(),actor,d)).id<>aid then raise exception 'Duplicate import';end if;
end $$;rollback;select true as verified;`);
try{execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','joicpkgvggfxzrdazisx','--file',file,'--output','json','--workdir',process.env.SUPABASE_TEST_WORKDIR],{stdio:['ignore','pipe','pipe'],windowsHide:true});}
catch{throw new Error('Publication SQL tests failed (private output omitted)');}
console.log('Publication, snapshots, stale revision, withdrawal, deletion, import idempotency and RPC permissions passed. Test fixtures rolled back.');
