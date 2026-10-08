alter table public.email_logs add column provider_payload jsonb;

create function public.queue_individual_mail(p_id uuid,p_actor uuid,p_recipient text,p_type text,p_content jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.email_logs;
begin
  if p_type not in ('individual','test') then raise exception 'INVALID_INPUT'; end if;
  insert into public.email_logs(id,recipient,type,subject,preheader,content,cta_label,cta_url,admin_id)
  values(p_id,p_recipient,p_type,p_content->>'subject',p_content->>'preheader',p_content->>'content',p_content->>'cta_label',p_content->>'cta_url',p_actor)
  on conflict(id) do nothing;
  select * into existing from public.email_logs where id=p_id;
  if existing.admin_id<>p_actor or existing.recipient<>p_recipient or existing.type<>p_type
    or existing.subject<>p_content->>'subject' or existing.preheader<>p_content->>'preheader'
    or existing.content<>p_content->>'content' or existing.cta_url<>p_content->>'cta_url'
    or existing.cta_label<>p_content->>'cta_label' then raise exception 'REQUEST_CONFLICT'; end if;
  if not exists(select 1 from public.commerce_audit where entity='email' and entity_id=p_id and action='EMAIL_QUEUED') then
    insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'email','EMAIL_QUEUED');
  end if;
  return p_id;
end $$;
revoke all on function public.queue_individual_mail(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.queue_individual_mail(uuid,uuid,text,text,jsonb) to service_role;

create function public.finish_admin_mail(p_id uuid,p_claim uuid,p_status text,p_provider_id text default null,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare campaign uuid;
begin
  if p_status not in ('sent','failed','suppressed','review') then raise exception 'INVALID_INPUT'; end if;
  update public.email_logs set status=p_status,provider_message_id=p_provider_id,error=p_error,
    delivery_status=case when p_status='sent' then 'accepted_by_provider' else null end,
    sent_at=case when p_status='sent' then now() else null end
    where id=p_id and claim_id=p_claim and status='processing' returning campaign_id into campaign;
  if campaign is not null then
    perform 1 from public.newsletter_campaigns where id=campaign for update;
    if not exists(select 1 from public.email_logs where campaign_id=campaign and status in ('pending','processing','failed')) then
      update public.newsletter_campaigns set
        status=case when exists(select 1 from public.email_logs where campaign_id=campaign and status='review') then 'review' else 'sent' end,
        sent_at=now() where id=campaign;
    end if;
  end if;
end $$;
revoke all on function public.finish_admin_mail(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_admin_mail(uuid,uuid,text,text,text) to service_role;
