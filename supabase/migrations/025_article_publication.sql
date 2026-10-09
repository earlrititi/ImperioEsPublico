create function public.transition_article(p_id uuid,p_actor uuid,p_revision integer,p_action text)
returns public.cms_articles language plpgsql security definer set search_path='' as $$
declare saved public.cms_articles;
begin
  select * into saved from public.cms_articles where id=p_id for update;
  if saved.id is null then raise exception 'ARTICLE_NOT_FOUND'; end if;
  if saved.revision<>p_revision then raise exception 'ARTICLE_CONFLICT'; end if;
  if saved.status='deleted' or p_action not in ('publish','withdraw','delete') then raise exception 'INVALID_STATE'; end if;
  if p_action='publish' then
    if length(trim(saved.draft->>'body'))<1 or length(trim(saved.draft->>'title'))<1
      or coalesce(saved.draft->>'publishedAt','')='' then raise exception 'INVALID_INPUT'; end if;
    update public.cms_articles set status='published',published_meta=draft-'body',published_body=draft->>'body'
      where id=p_id;
  elsif p_action='withdraw' then
    if saved.status<>'published' then raise exception 'INVALID_STATE'; end if;
    update public.cms_articles set status='withdrawn' where id=p_id;
  else
    if saved.status='published' then raise exception 'INVALID_STATE'; end if;
    update public.cms_articles set status='deleted' where id=p_id;
  end if;
  update public.cms_articles set revision=revision+1,updated_by=p_actor,updated_at=now()
    where id=p_id returning * into saved;
  insert into public.commerce_audit(actor_id,entity_id,entity,action)
    values(p_actor,p_id,'article','ARTICLE_'||upper(p_action));
  return saved;
end $$;
revoke all on function public.transition_article(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.transition_article(uuid,uuid,integer,text) to service_role;

create function public.import_article_draft(p_id uuid,p_actor uuid,p_draft jsonb)
returns public.cms_articles language plpgsql security definer set search_path='' as $$
declare saved public.cms_articles;
begin
  select * into saved from public.cms_articles where slug=p_draft->>'slug';
  if saved.id is not null then return saved; end if;
  insert into public.cms_articles(id,slug,legacy_slug,draft,created_by,updated_by)
    values(p_id,p_draft->>'slug',p_draft->>'slug',p_draft,p_actor,p_actor) returning * into saved;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'article','ARTICLE_IMPORTED');
  return saved;
exception when unique_violation then raise exception 'ARTICLE_CONFLICT';
end $$;
revoke all on function public.import_article_draft(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.import_article_draft(uuid,uuid,jsonb) to service_role;
