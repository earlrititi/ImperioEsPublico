create function public.save_article_draft(p_id uuid,p_actor uuid,p_revision integer,p_draft jsonb)
returns public.cms_articles language plpgsql security definer set search_path='' as $$
declare saved public.cms_articles; action_name text;
begin
  if p_revision is null or p_revision<0 or p_draft is null or jsonb_typeof(p_draft)<>'object' then raise exception 'INVALID_INPUT'; end if;
  if p_revision=0 then
    insert into public.cms_articles(id,slug,draft,created_by,updated_by)
      values(p_id,p_draft->>'slug',p_draft,p_actor,p_actor) on conflict(id) do nothing returning * into saved;
    if saved.id is null then
      select * into saved from public.cms_articles where id=p_id;
      if saved.created_by=p_actor and saved.revision=1 and saved.draft=p_draft then return saved; end if;
      raise exception 'ARTICLE_CONFLICT';
    end if;
    action_name:='ARTICLE_CREATED';
  else
    select * into saved from public.cms_articles where id=p_id for update;
    if saved.id is null then raise exception 'ARTICLE_NOT_FOUND'; end if;
    if saved.revision<>p_revision then raise exception 'ARTICLE_CONFLICT'; end if;
    if saved.status='deleted' then raise exception 'INVALID_STATE'; end if;
    -- Preserve canonical URLs, including after unpublishing a once-public article.
    if (saved.published_meta is not null or saved.legacy_slug is not null) and saved.slug<>p_draft->>'slug' then
      raise exception 'ARTICLE_SLUG_LOCKED';
    end if;
    update public.cms_articles set slug=p_draft->>'slug',draft=p_draft,revision=revision+1,
      updated_by=p_actor,updated_at=now() where id=p_id returning * into saved;
    action_name:='ARTICLE_UPDATED';
  end if;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'article',action_name);
  return saved;
exception when unique_violation then raise exception 'ARTICLE_SLUG_EXISTS';
end $$;
revoke all on function public.save_article_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_article_draft(uuid,uuid,integer,jsonb) to service_role;
