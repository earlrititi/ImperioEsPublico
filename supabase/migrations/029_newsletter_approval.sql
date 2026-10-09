create function public.queue_newsletter_revision(p_id uuid,p_emails text[],p_actor uuid,p_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.newsletter_campaigns;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into c from public.newsletter_campaigns where id=p_id for update;
  if c.id is null or c.created_by<>p_actor or c.revision<>p_revision or c.status<>'draft' then
    raise exception 'REQUEST_CONFLICT';
  end if;
  return public.queue_newsletter(p_id,p_emails,p_actor);
end $$;
revoke all on function public.queue_newsletter_revision(uuid,text[],uuid,integer) from public,anon,authenticated;
grant execute on function public.queue_newsletter_revision(uuid,text[],uuid,integer) to service_role;
