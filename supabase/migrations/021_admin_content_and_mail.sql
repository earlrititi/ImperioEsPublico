alter table public.commerce_audit add column if not exists entity text not null default 'reservation';

create table public.cms_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=160),
  legacy_slug text unique,
  status text not null default 'draft' check(status in ('draft','published','withdrawn','deleted')),
  draft jsonb not null,
  published_meta jsonb,
  published_body text,
  revision integer not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check(segment in ('shirts','subscriptions','arcabucero','maestre_campo','both','all')),
  subject text not null, preheader text not null default '', content text not null,
  cta_label text not null default '', cta_url text not null default '',
  status text not null default 'draft' check(status in ('draft','sending','sent','review')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), sent_at timestamptz,
  recipient_count integer not null default 0
);
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.newsletter_campaigns(id),
  recipient text not null,
  type text not null check(type in ('individual','campaign','test')),
  subject text not null, preheader text not null default '', content text not null,
  cta_label text not null default '', cta_url text not null default '',
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','review','suppressed')),
  provider_message_id text, delivery_status text, error text,
  admin_id uuid not null references auth.users(id),
  claim_id uuid, claimed_at timestamptz, first_attempt_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(), sent_at timestamptz,
  unique(campaign_id,recipient)
);
create table public.email_suppressions (
  email text primary key check(email=lower(trim(email))),
  created_at timestamptz not null default now(),
  reason text not null default 'unsubscribe'
);
do $$ declare t text; begin
  foreach t in array array['cms_articles','newsletter_campaigns','email_logs','email_suppressions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

create function public.claim_admin_mail() returns setof public.email_logs
language plpgsql security definer set search_path='' as $$
declare candidate uuid;
begin
  update public.email_logs set status='review',error='Automatic retry window exceeded'
    where status in ('pending','processing','failed') and first_attempt_at < now()-interval '23 hours';
  select id into candidate from public.email_logs
    where status='pending' or (status in ('processing','failed') and claimed_at<now()-interval '5 minutes')
    order by created_at for update skip locked limit 1;
  if candidate is null then return; end if;
  return query update public.email_logs set status='processing',claim_id=gen_random_uuid(),
    claimed_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
    where id=candidate returning *;
end $$;
revoke all on function public.claim_admin_mail() from public,anon,authenticated;
grant execute on function public.claim_admin_mail() to service_role;

create function public.queue_newsletter(p_id uuid,p_emails text[],p_actor uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.newsletter_campaigns; n integer;
begin
  select * into c from public.newsletter_campaigns where id=p_id for update;
  if c.id is null or c.status<>'draft' then raise exception 'INVALID_STATE'; end if;
  if cardinality(p_emails)=0 or cardinality(p_emails)>10000 then raise exception 'INVALID_AUDIENCE'; end if;
  insert into public.email_logs(campaign_id,recipient,type,subject,preheader,content,cta_label,cta_url,admin_id)
    select c.id,lower(trim(email)),'campaign',c.subject,c.preheader,c.content,c.cta_label,c.cta_url,p_actor
    from unnest(p_emails) email on conflict do nothing;
  get diagnostics n=row_count;
  update public.newsletter_campaigns set status='sending',recipient_count=n where id=c.id;
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,c.id,'newsletter','NEWSLETTER_QUEUED');
  return n;
end $$;
revoke all on function public.queue_newsletter(uuid,text[],uuid) from public,anon,authenticated;
grant execute on function public.queue_newsletter(uuid,text[],uuid) to service_role;
