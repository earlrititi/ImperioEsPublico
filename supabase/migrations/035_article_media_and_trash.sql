insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('article-media','article-media',false,3145728,array['image/webp'])
on conflict(id) do nothing;

-- Deletion is reversible and preserves the snapshot tombstone for legacy URLs.
create or replace function public.transition_article(p_id uuid,p_actor uuid,p_revision integer,p_action text)
returns public.cms_articles language plpgsql security definer set search_path='' as $$
declare saved public.cms_articles;
begin
  select * into saved from public.cms_articles where id=p_id for update;
  if saved.id is null then raise exception 'ARTICLE_NOT_FOUND'; end if;
  if saved.revision<>p_revision then raise exception 'ARTICLE_CONFLICT'; end if;
  if p_action not in ('publish','withdraw','delete','restore') then raise exception 'INVALID_STATE'; end if;
  if p_action='restore' then
    if saved.status<>'deleted' then raise exception 'INVALID_STATE'; end if;
    update public.cms_articles set status=case when published_meta is null then 'draft' else 'withdrawn' end where id=p_id;
  else
    if saved.status='deleted' then raise exception 'INVALID_STATE'; end if;
    if p_action='publish' then
      if length(trim(saved.draft->>'body'))<1 or length(trim(saved.draft->>'title'))<1
        or coalesce(saved.draft->>'publishedAt','')='' then raise exception 'INVALID_INPUT'; end if;
      update public.cms_articles set status='published',published_meta=draft-'body',published_body=draft->>'body' where id=p_id;
    elsif p_action='withdraw' then
      if saved.status<>'published' then raise exception 'INVALID_STATE'; end if;
      update public.cms_articles set status='withdrawn' where id=p_id;
    else
      update public.cms_articles set status='deleted' where id=p_id;
    end if;
  end if;
  update public.cms_articles set revision=revision+1,updated_by=p_actor,updated_at=now() where id=p_id returning * into saved;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'article','ARTICLE_'||upper(p_action));
  return saved;
end $$;
revoke all on function public.transition_article(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.transition_article(uuid,uuid,integer,text) to service_role;
