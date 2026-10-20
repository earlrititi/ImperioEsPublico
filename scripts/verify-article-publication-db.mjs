import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cli=join(process.env.LOCALAPPDATA,'npm-cache/_npx/aa8e5c70f9d8d161/node_modules/supabase/dist/supabase.js');
const file=join(mkdtempSync(join(tmpdir(),'imperio-publish-test-')),'test.sql');
writeFileSync(file,`begin;
${readFileSync('supabase/migrations/038_article_legacy_lifecycle.sql','utf8')}
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
  a:=public.transition_article(aid,actor,a.revision,'delete');
  if a.status<>'deleted' then raise exception 'Published soft delete failed';end if;
  a:=public.transition_article(aid,actor,a.revision,'restore');
  if a.status<>'withdrawn' then raise exception 'Restore republished the article';end if;
  a:=public.transition_article(aid,actor,a.revision,'publish');
  a:=public.transition_article(aid,actor,a.revision,'withdraw');
  if a.status<>'withdrawn' then raise exception 'Withdrawal failed';end if;
  a:=public.transition_article(aid,actor,a.revision,'delete');
  if a.status<>'deleted' then raise exception 'Delete failed';end if;
  aid:=gen_random_uuid();d:=jsonb_build_object('slug','import-'||aid,'title','Legacy','body','<p>Legacy</p>');
  a:=public.import_article_draft(aid,actor,d);
  if a.published_meta is not null or a.legacy_slug<>a.slug then raise exception 'Import changed publication';end if;
  if (public.import_article_draft(gen_random_uuid(),actor,d)).id<>aid then raise exception 'Duplicate import';end if;
  a:=public.transition_article(aid,actor,a.revision,'withdraw');
  if a.status<>'withdrawn' or a.published_meta is not null then raise exception 'Legacy withdrawal failed';end if;
  a:=public.transition_article(aid,actor,a.revision,'delete');
  a:=public.transition_article(aid,actor,a.revision,'restore');
  if a.status<>'withdrawn' or a.published_meta is not null then raise exception 'Legacy restore republished the file';end if;
  begin perform public.save_article_draft(aid,actor,a.revision,d||jsonb_build_object('slug','changed-'||aid));raise exception 'Legacy URL changed';
    exception when others then if sqlerrm<>'ARTICLE_SLUG_LOCKED' then raise;end if;end;
  aid:=gen_random_uuid();d:=jsonb_build_object('slug','never-public-'||aid,'title','Draft','body','<p>Draft</p>');
  a:=public.save_article_draft(aid,actor,0,d);
  a:=public.transition_article(aid,actor,a.revision,'delete');
  a:=public.transition_article(aid,actor,a.revision,'restore');
  if a.status<>'draft' or a.published_meta is not null then raise exception 'New draft restore changed visibility';end if;
end $$;rollback;select true as verified;`);
try{execFileSync(process.execPath,[cli,'db','query','--linked','--project-ref','joicpkgvggfxzrdazisx','--file',file,'--output','json','--workdir',process.env.SUPABASE_TEST_WORKDIR],{stdio:['ignore','pipe','pipe'],windowsHide:true});}
catch{throw new Error('Publication SQL tests failed (private output omitted)');}
console.log('Publication, snapshots, stale revision, legacy withdrawal/trash/restore, canonical URLs, import idempotency and RPC permissions passed. Migration and Test fixtures rolled back.');
