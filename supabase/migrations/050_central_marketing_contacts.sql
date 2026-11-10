-- Additive, prospective only. No historical enrollment and no runtime activation.
create table public.marketing_email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check(email=lower(trim(email)) and length(email)<=254),
  name text not null default '', source text not null,
  context_id text not null, consent_id uuid not null references public.legal_consents(id),
  token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null, verified_at timestamptz, consumed_at timestamptz,
  confirmation_provider_id text, confirmation_sent_at timestamptz,
  confirmation_first_attempt_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.marketing_email_verifications enable row level security;
revoke all on public.marketing_email_verifications from public,anon,authenticated;
grant select,insert,update on public.marketing_email_verifications to service_role;

create function public.confirm_marketing_email(p_id uuid,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare target public.marketing_email_verifications;
begin
  select * into target from public.marketing_email_verifications where id=p_id for update;
  if target.id is null or target.token_hash<>p_hash or target.expires_at<now() or target.consumed_at is not null then return false;end if;
  if exists(select 1 from public.marketing_suppressed_contacts s where s.email=target.email) then return false;end if;
  if not exists(select 1 from public.legal_consents c where c.id=target.consent_id and c.accepted and c.withdrawn_at is null and c.consent_type='marketing_email') then return false;end if;
  update public.marketing_email_verifications set verified_at=clock_timestamp(),consumed_at=clock_timestamp() where id=p_id;
  return true;
end $$;
revoke all on function public.confirm_marketing_email(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_marketing_email(uuid,text) to service_role;

-- Shared eligible read model, latest account choice wins; no email joins before proof.
create view public.marketing_email_contacts with(security_barrier=true) as
with candidates as (
  select u.id as user_id,lower(trim(u.email)) as email,coalesce(p.full_name,'') as name,
    c.id as consent_id,c.created_at as marketing_accepted_at,u.email_confirmed_at as verified_at,
    c.source,greatest(c.created_at,u.email_confirmed_at) as welcome_at
  from auth.users u join public.profiles p on p.id=u.id and lower(trim(p.email))=lower(trim(u.email))
  join lateral(select * from public.legal_consents lc where lc.user_id=u.id and lc.consent_type='marketing_email'
    order by lc.created_at desc,lc.id desc limit 1)c on c.accepted and c.withdrawn_at is null
  where u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
  union all
  select null::uuid,v.email,v.name,c.id,c.created_at,v.verified_at,v.source,greatest(c.created_at,v.verified_at)
  from public.marketing_email_verifications v join public.legal_consents c on c.id=v.consent_id
  where v.verified_at is not null and c.accepted and c.withdrawn_at is null
    and not exists(select 1 from auth.users u join public.legal_consents lc on lc.user_id=u.id and lc.consent_type='marketing_email'
      where lower(trim(u.email))=v.email and (not lc.accepted or lc.withdrawn_at is not null)
        and greatest(lc.created_at,coalesce(lc.withdrawn_at,lc.created_at))>=c.created_at)
)
select distinct on (email) * from candidates c
where not exists(select 1 from public.marketing_suppressed_contacts s where s.email=c.email)
order by email,(user_id is not null) desc,marketing_accepted_at desc;
revoke all on public.marketing_email_contacts from public,anon,authenticated;
grant select on public.marketing_email_contacts to service_role;

alter table public.marketing_automation_jobs alter column user_id drop not null;
alter table public.marketing_automation_jobs add column contact_email text;
alter table public.marketing_automation_jobs add constraint marketing_job_identity check(user_id is not null or contact_email is not null);
create unique index marketing_welcome_email_step_idx on public.marketing_automation_jobs(contact_email,key,step) where key='welcome';
alter table public.marketing_automation_runtime add column last_contact_email text;
alter table public.marketing_automation_runtime add column last_notice_email text;

create or replace function public.claim_marketing_automation() returns setof public.marketing_automation_jobs
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  update public.marketing_automation_jobs set status='review',reason='IDEMPOTENCY_WINDOW_EXCEEDED'
    where status in ('pending','processing') and first_attempt_at<now()-interval '23 hours';
  select id into target from public.marketing_automation_jobs where contact_email is null and due_at<=now()
    and (status='pending' or (status='processing' and claimed_at<now()-interval '5 minutes')) order by due_at for update skip locked limit 1;
  if target is null then return;end if;
  return query update public.marketing_automation_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=target returning *;
end $$;
create function public.claim_contact_welcome() returns setof public.marketing_automation_jobs
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  update public.marketing_automation_jobs set status='review',reason='IDEMPOTENCY_WINDOW_EXCEEDED'
    where contact_email is not null and status in ('pending','processing') and first_attempt_at<now()-interval '23 hours';
  select id into target from public.marketing_automation_jobs where contact_email is not null and key='welcome' and due_at<=now()
    and (status='pending' or (status='processing' and claimed_at<now()-interval '5 minutes')) order by due_at for update skip locked limit 1;
  if target is null then return;end if;
  return query update public.marketing_automation_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=target returning *;
end $$;
revoke all on function public.claim_contact_welcome() from public,anon,authenticated;
grant execute on function public.claim_contact_welcome() to service_role;

-- One welcome series per verified email, including buyers; original recovery logic stays separate.
create function public.queue_contact_welcome(p_email text,p_step text,p_due timestamptz,p_revision integer,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare contact public.marketing_email_contacts; target uuid; start_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('marketing-email:'||p_email,0));
  select enrollment_starts_at into start_at from public.marketing_automation_runtime
    where enabled and template_digest=p_digest and enrollment_starts_at<=now();
  select * into contact from public.marketing_email_contacts where email=p_email;
  if start_at is null or contact.email is null or contact.marketing_accepted_at<start_at or p_due>now() or p_due<contact.welcome_at then return null;end if;
  if exists(select 1 from public.marketing_automation_jobs j where (j.contact_email=p_email or j.user_id=contact.user_id)
    and (j.status in ('pending','processing') or j.sent_at>now()-interval '6 hours')) then return null;end if;
  if exists(select 1 from public.marketing_automation_jobs j where (j.contact_email=p_email or j.user_id=contact.user_id) and j.key='welcome' and j.step=p_step) then return null;end if;
  insert into public.marketing_automation_jobs(user_id,contact_email,consent_id,key,step,anchor,due_at,revision,template_digest)
    values(contact.user_id,p_email,contact.consent_id,'welcome',p_step,contact.welcome_at,p_due,p_revision,p_digest)
    on conflict do nothing returning id into target;
  return target;
end $$;
revoke all on function public.queue_contact_welcome(text,text,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.queue_contact_welcome(text,text,timestamptz,integer,text) to service_role;

create table public.marketing_subscription_notices (
  email text primary key, consent_id uuid not null references public.legal_consents(id),
  status text not null default 'pending' check(status in ('pending','processing','sent','review')),
  claim_id uuid,claimed_at timestamptz,first_attempt_at timestamptz,next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,provider_id text,sent_at timestamptz,created_at timestamptz not null default now()
);
alter table public.marketing_subscription_notices enable row level security;
revoke all on public.marketing_subscription_notices from public,anon,authenticated;
grant select,insert,update on public.marketing_subscription_notices to service_role;
create function public.claim_marketing_subscription_notice() returns setof public.marketing_subscription_notices
language plpgsql security definer set search_path='' as $$
declare target text;
begin
  update public.marketing_subscription_notices set status='review' where status in ('pending','processing') and first_attempt_at<now()-interval '23 hours';
  select email into target from public.marketing_subscription_notices where next_attempt_at<=now()
    and (status='pending' or (status='processing' and claimed_at<now()-interval '5 minutes')) order by created_at for update skip locked limit 1;
  if target is null then return;end if;
  return query update public.marketing_subscription_notices set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where email=target returning *;
end $$;
revoke all on function public.claim_marketing_subscription_notice() from public,anon,authenticated;
grant execute on function public.claim_marketing_subscription_notice() to service_role;

-- Existing withdrawal paths cancel anonymous welcome leases as well.
create function public.stop_contact_welcome_on_suppression() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.marketing_automation_jobs set status='suppressed',reason='EMAIL_SUPPRESSED',provider_payload=null,claim_id=null
    where contact_email=new.email and status in ('pending','processing');
  return new;
end $$;
create trigger stop_contact_welcome_on_suppression after insert or update on public.email_suppressions
for each row execute function public.stop_contact_welcome_on_suppression();
revoke all on function public.stop_contact_welcome_on_suppression() from public,anon,authenticated;

create or replace function public.stop_marketing_automation_after_purchase() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.marketing_automation_jobs j set status='suppressed',reason='PAID_ORDER',provider_payload=null,claim_id=null
    where j.key<>'welcome' and j.status in ('pending','processing') and
      (j.contact_email=lower(trim(new.customer_email)) or exists(select 1 from auth.users u where u.id=j.user_id and lower(trim(u.email))=lower(trim(new.customer_email))));
  return new;
end $$;
