begin;
do $$ declare actor uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); a public.cms_articles; d jsonb;
begin
  if not exists(select 1 from storage.buckets where id='article-media' and not public and file_size_limit=3145728 and allowed_mime_types=array['image/webp']) then raise exception 'Unsafe media bucket';end if;
  if has_function_privilege('anon','public.transition_article(uuid,uuid,integer,text)','EXECUTE') or
    has_function_privilege('authenticated','public.transition_article(uuid,uuid,integer,text)','EXECUTE') then raise exception 'Public mutation';end if;
  insert into auth.users(id,email) values(actor,'cms-test-'||actor||'@example.invalid');
  d:=jsonb_build_object('slug','cms-'||aid,'title','Title','body','<p>Original private body</p>','publishedAt','2026-10-18');
  a:=public.save_article_draft(aid,actor,0,d);
  a:=public.transition_article(aid,actor,a.revision,'publish');
  a:=public.transition_article(aid,actor,a.revision,'delete');
  if a.status<>'deleted' or a.published_body<>'<p>Original private body</p>' or a.published_meta is null then raise exception 'Deletion lost snapshot';end if;
  begin perform public.transition_article(aid,actor,a.revision-1,'restore');raise exception 'Stale restore allowed';
    exception when others then if sqlerrm<>'ARTICLE_CONFLICT' then raise;end if;end;
  a:=public.transition_article(aid,actor,a.revision,'restore');
  if a.status<>'withdrawn' then raise exception 'Restoration republished the article';end if;
  a:=public.transition_article(aid,actor,a.revision,'publish');
  if a.status<>'published' then raise exception 'Republish failed';end if;
  if not exists(select 1 from public.commerce_audit where entity_id=aid and action='ARTICLE_RESTORE') then raise exception 'Missing audit';end if;
  aid:=gen_random_uuid();d:=d||jsonb_build_object('slug','draft-'||aid);
  a:=public.save_article_draft(aid,actor,0,d);
  a:=public.transition_article(aid,actor,a.revision,'delete');
  a:=public.transition_article(aid,actor,a.revision,'restore');
  if a.status<>'draft' then raise exception 'New draft restoration failed';end if;
end $$;
rollback;
select true as verified;
