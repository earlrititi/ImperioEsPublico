create function public.seo_generation_stage(p_job uuid,p_claim uuid,p_stage text) returns void
language plpgsql security definer set search_path='' as $$
declare j public.seo_jobs; current_state text;
begin
  select * into j from public.seo_jobs where id=p_job for update;
  if j.id is null or j.kind<>'generate' or j.status<>'processing' or j.claim_id is distinct from p_claim then raise exception 'REQUEST_CONFLICT'; end if;
  select status into current_state from public.seo_opportunities where id=j.opportunity_id for update;
  if not (p_stage='generating' and current_state='researching' or p_stage='validating' and current_state='generating') then raise exception 'INVALID_STATE'; end if;
  update public.seo_opportunities set status=p_stage,updated_at=now() where id=j.opportunity_id;
end $$;
revoke all on function public.seo_generation_stage(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.seo_generation_stage(uuid,uuid,text) to service_role;

create or replace function public.seo_complete_generation(p_job uuid,p_claim uuid,p_draft jsonb,p_verification jsonb,p_sources jsonb,p_usage jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare j public.seo_jobs; o public.seo_opportunities; article public.cms_articles; previous public.seo_reviews; target_review_id uuid;
begin
  select * into j from public.seo_jobs where id=p_job for update;
  if j.id is null then raise exception 'INVALID_INPUT'; end if;
  if j.status='succeeded' then return (j.result->>'reviewId')::uuid; end if;
  if j.status<>'processing' or j.claim_id is distinct from p_claim then raise exception 'REQUEST_CONFLICT'; end if;
  perform public.seo_assert_actor(j.actor_id);
  select * into o from public.seo_opportunities where id=j.opportunity_id for update;
  if o.status<>'validating' then raise exception 'INVALID_STATE'; end if;
  if o.data->>'targetSlug' is not null then raise exception 'SEO_UPDATE_REQUIRES_MANUAL_IMPORT'; end if;
  select * into previous from public.seo_reviews where opportunity_id=o.id order by created_at desc,id desc limit 1 for update;
  if previous.id is not null then
    if previous.status not in ('needs_changes','rejected') then raise exception 'INVALID_STATE'; end if;
    select * into article from public.cms_articles where id=previous.article_id for update;
    if article.status<>'draft' or article.published_meta is not null or article.legacy_slug is not null then raise exception 'SEO_UPDATE_REQUIRES_MANUAL_IMPORT'; end if;
    -- Regeneration is a proposed version of the same unpublished CMS record.
    p_draft:=jsonb_set(p_draft,'{slug}',to_jsonb(article.slug));
    article:=public.save_article_draft(article.id,j.actor_id,article.revision,p_draft);
  else article:=public.save_article_draft(gen_random_uuid(),j.actor_id,0,p_draft);
  end if;
  insert into public.seo_reviews(opportunity_id,article_id,article_revision,snapshot,verification,source_snapshot)
    values(o.id,article.id,article.revision,p_draft,p_verification,p_sources) returning id into target_review_id;
  insert into public.seo_jobs(kind,job_key,opportunity_id,review_id,actor_id,payload)
    values('notify','review:'||target_review_id,o.id,target_review_id,j.actor_id,jsonb_build_object('event','review')) on conflict do nothing;
  update public.seo_opportunities set status='pending_review',revision=revision+1,updated_at=now() where id=o.id;
  update public.seo_jobs set status='succeeded',result=jsonb_build_object('reviewId',target_review_id),input_tokens=(p_usage->>'inputTokens')::integer,
    output_tokens=(p_usage->>'outputTokens')::integer,actual_cents=coalesce((p_usage->>'costCents')::integer,reserved_cents),finished_at=now() where id=j.id;
  return target_review_id;
end $$;
