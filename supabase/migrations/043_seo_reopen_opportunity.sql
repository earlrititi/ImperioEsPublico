create function public.seo_reopen_opportunity(p_actor uuid,p_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.seo_opportunities;
begin
  perform public.seo_assert_actor(p_actor);
  select * into o from public.seo_opportunities where id=p_id for update;
  if o.id is null or o.revision is distinct from p_revision then raise exception 'REQUEST_CONFLICT'; end if;
  if o.status not in ('approved','archived','rejected') or exists(select 1 from public.seo_jobs where opportunity_id=p_id and kind='generate' and status in ('pending','processing','needs_review'))
    or exists(select 1 from public.seo_reviews where opportunity_id=p_id and status in ('pending_review','approved','published')) then raise exception 'INVALID_STATE'; end if;
  update public.seo_opportunities set status='proposed',revision=revision+1,updated_by=p_actor,updated_at=now() where id=p_id returning * into o;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'seo','OPPORTUNITY_REOPENED');
  return to_jsonb(o);
end $$;
revoke all on function public.seo_reopen_opportunity(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.seo_reopen_opportunity(uuid,uuid,integer) to service_role;
