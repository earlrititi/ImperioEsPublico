create table public.funnel_runs (
  id uuid not null,flow text not null check(flow in ('manifesto','subscriptions','shirts')),
  page text not null,stages jsonb not null default '[]',
  created_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),
  primary key(id,flow)
);
create index on public.funnel_runs(created_at);
create table public.manifesto_requests (
  id uuid primary key,email text not null,name text not null,
  source text not null,marketing_consent boolean not null default false,
  status text not null default 'pending' check(status in ('pending','accepted','failed')),
  provider_id text,created_at timestamptz not null default now(),accepted_at timestamptz
);
create index on public.manifesto_requests(created_at);
do $$ declare t text;begin
  foreach t in array array['funnel_runs','manifesto_requests'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create function public.record_funnel_step(p_id uuid,p_flow text,p_step integer,p_page text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_flow not in ('manifesto','subscriptions','shirts') or p_step<0 or p_step>(case when p_flow='shirts' then 5 else 4 end)
    or p_page !~ '^/($|manifiesto/?$|suscribirse/?$|precios/?$|instagram/?$|tienda/?$|reservas/?$|checkout/(arcabucero-(monthly|annual)|maestre-campo-(monthly|annual))/?$)' then raise exception 'INVALID_INPUT';end if;
  insert into public.funnel_runs(id,flow,page,stages) values(p_id,p_flow,p_page,jsonb_build_array(p_step))
  on conflict(id,flow) do update set
    stages=case when public.funnel_runs.stages @> jsonb_build_array(p_step) then public.funnel_runs.stages else public.funnel_runs.stages||jsonb_build_array(p_step) end,
    last_seen_at=now();
end $$;
revoke all on function public.record_funnel_step(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.record_funnel_step(uuid,text,integer,text) to service_role;
alter table public.newsletter_campaigns drop constraint newsletter_campaigns_segment_check;
alter table public.newsletter_campaigns add constraint newsletter_campaigns_segment_check check(segment in ('shirts','subscriptions','arcabucero','maestre_campo','both','all','manifesto','leads'));
alter table public.newsletter_campaigns add column revision integer not null default 1;
alter table public.newsletter_campaigns add column updated_at timestamptz not null default now();
alter table public.email_logs add column provider_checked_at timestamptz;
create function public.save_newsletter_draft(p_id uuid,p_actor uuid,p_revision integer,p_segment text,p_content jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.newsletter_campaigns;n integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into c from public.newsletter_campaigns where id=p_id for update;
  if found then
    if c.created_by<>p_actor or c.status<>'draft' or c.revision<>p_revision then raise exception 'REQUEST_CONFLICT';end if;
    update public.newsletter_campaigns set name=p_content->>'subject',subject=p_content->>'subject',preheader=p_content->>'preheader',
      content=p_content->>'content',cta_label=p_content->>'cta_label',cta_url=p_content->>'cta_url',segment=p_segment,revision=revision+1,updated_at=now()
      where id=p_id returning revision into n;
  else
    if p_revision<>0 then raise exception 'REQUEST_CONFLICT';end if;
    insert into public.newsletter_campaigns(id,name,subject,preheader,content,cta_label,cta_url,segment,created_by)
      values(p_id,p_content->>'subject',p_content->>'subject',p_content->>'preheader',p_content->>'content',p_content->>'cta_label',p_content->>'cta_url',p_segment,p_actor)
      returning revision into n;
  end if;
  insert into public.commerce_audit(actor_id,entity,entity_id,action)values(p_actor,'newsletter',p_id,'NEWSLETTER_DRAFT_SAVED');
  return n;
end $$;
revoke all on function public.save_newsletter_draft(uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_newsletter_draft(uuid,uuid,integer,text,jsonb) to service_role;
create or replace function private.dispatch_commerce_maintenance() returns bigint
language plpgsql security definer set search_path='' as $$
declare request_id bigint;secret text;
begin
  delete from public.funnel_runs where created_at<now()-interval '90 days';
  if not exists(select 1 from public.commerce_outbox where status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
  and not exists(select 1 from public.email_logs where status='pending' or (status in ('processing','failed') and claimed_at<now()-interval '5 minutes')
    or (status='sent' and sent_at>now()-interval '7 days' and (provider_checked_at is null or provider_checked_at<now()-interval '6 hours')))
  and not exists(select 1 from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_FAILED','PAYMENT_PENDING') and expires_at<=now())
  and not exists(select 1 from public.commerce_campaign c where c.purchase_activated and (c.purchase_open_at is null or c.purchase_open_at<=now())
    and exists(select 1 from public.reservations where status='RESERVED')) then return null;end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='imperio_commerce_job_secret';
  if secret is null then raise exception 'MAINTENANCE_SECRET_MISSING';end if;
  select net.http_post(url:='https://imperioes.com/api/commerce-maintenance',headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=30000)into request_id;
  return request_id;
end $$;
revoke all on function private.dispatch_commerce_maintenance() from public,anon,authenticated;
