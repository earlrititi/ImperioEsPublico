create table public.marketing_automation_runtime (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  template_digest text check(template_digest ~ '^[a-f0-9]{64}$'),
  purchase_proof_id uuid references public.commerce_orders(id),
  last_user_id uuid,
  check(not enabled or (approved_by is not null and approved_at is not null and template_digest is not null and purchase_proof_id is not null))
);
insert into public.marketing_automation_runtime(id) values(true);

create table public.marketing_automation_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  visited_at timestamptz, product_at timestamptz, cart_at timestamptz, checkout_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.marketing_automation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_id uuid not null references public.legal_consents(id),
  key text not null check(key in ('welcome','checkout','viewed_product','site','cart')),
  step text not null, anchor timestamptz not null, due_at timestamptz not null,
  revision integer not null check(revision>=0),
  template_digest text not null check(template_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check(status in ('pending','processing','sent','suppressed','review')),
  claim_id uuid, claimed_at timestamptz, first_attempt_at timestamptz,
  attempts integer not null default 0,
  provider_payload jsonb, provider_id text, delivery_status text, provider_checked_at timestamptz,
  sent_at timestamptz, reason text,
  created_at timestamptz not null default now(),
  unique(user_id,key,step,anchor)
);
create index marketing_automation_jobs_user_idx on public.marketing_automation_jobs(user_id,sent_at desc);
create index marketing_automation_jobs_due_idx on public.marketing_automation_jobs(due_at) where status in ('pending','processing');

do $$ declare t text;begin
  foreach t in array array['marketing_automation_runtime','marketing_automation_activity','marketing_automation_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
end $$;

-- Verified identities only; a profile or a browser event cannot verify an email.
create view public.marketing_automation_subjects with(security_barrier=true) as
select u.id as user_id,lower(trim(u.email)) as email,coalesce(p.full_name,'') as name,
  c.id as consent_id,c.created_at as marketing_accepted_at,
  greatest(c.created_at,u.email_confirmed_at) as welcome_at,
  a.visited_at,a.product_at,a.cart_at,a.checkout_at,
  ac.accepted as analytics_accepted,ac.document_version as analytics_version,ac.created_at as analytics_at,ac.withdrawn_at as analytics_withdrawn_at,
  (select max(o.paid_at) from public.commerce_orders o where lower(trim(o.customer_email))=lower(trim(u.email))) as paid_at,
  (exists(select 1 from public.subscriptions s where (s.user_id=u.id or lower(trim(s.email))=lower(trim(u.email))) and s.status<>'legacy_unverified')) as billing_record,
  (exists(select 1 from public.reservations r join public.reservation_payment_attempts pa on pa.reservation_id=r.id
    where (r.user_id=u.id or lower(trim(r.customer_email))=lower(trim(u.email))) and pa.status='OPEN')) as payment_in_progress
from auth.users u join public.profiles p on p.id=u.id and lower(trim(p.email))=lower(trim(u.email))
join lateral(select * from public.legal_consents c where c.user_id=u.id and c.consent_type='marketing_email'
  order by c.created_at desc,c.id desc limit 1)c on c.accepted and c.withdrawn_at is null
left join public.marketing_automation_activity a on a.user_id=u.id
left join lateral(select * from public.legal_consents c where c.user_id=u.id and c.consent_type='cookies_analytics'
  order by c.created_at desc,c.id desc limit 1)ac on true
where u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())
  and not exists(select 1 from public.email_suppressions s where s.email=lower(trim(u.email)))
  and not exists(select 1 from public.legal_consents c where c.user_id=u.id and c.consent_type='marketing_email' and c.withdrawn_at is not null)
  and not exists(select 1 from public.reservations r where lower(trim(r.customer_email))=lower(trim(u.email)) and r.marketing_withdrawn_at is not null);
revoke all on public.marketing_automation_subjects from public,anon,authenticated;
grant select on public.marketing_automation_subjects to service_role;

create function public.record_marketing_automation_activity(p_user uuid,p_kind text,p_version text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_kind not in ('site','viewed_product','cart','checkout','cart_cleared') then raise exception 'INVALID_INPUT';end if;
  if not exists(select 1 from public.marketing_automation_subjects where user_id=p_user and analytics_accepted and analytics_withdrawn_at is null
    and analytics_version=p_version and analytics_at>now()-interval '365 days' and analytics_at<=now() and paid_at is null and not billing_record) then return false;end if;
  if p_kind='cart_cleared' then
    update public.marketing_automation_activity set visited_at=null,product_at=null,cart_at=null,checkout_at=null,updated_at=now() where user_id=p_user;
    update public.marketing_automation_jobs set status='suppressed',reason='CART_CLEARED',provider_payload=null,claim_id=null
      where user_id=p_user and key<>'welcome' and status in ('pending','processing');
    return true;
  end if;
  insert into public.marketing_automation_activity(user_id,visited_at,product_at,cart_at,checkout_at)
    values(p_user,case when p_kind='site' then now() end,case when p_kind='viewed_product' then now() end,
      case when p_kind='cart' then now() end,case when p_kind='checkout' then now() end)
    on conflict(user_id) do update set visited_at=coalesce(excluded.visited_at,marketing_automation_activity.visited_at),
      product_at=coalesce(excluded.product_at,marketing_automation_activity.product_at),cart_at=coalesce(excluded.cart_at,marketing_automation_activity.cart_at),
      checkout_at=coalesce(excluded.checkout_at,marketing_automation_activity.checkout_at),updated_at=now();
  return true;
end $$;

create function public.queue_marketing_automation(p_user uuid,p_consent uuid,p_key text,p_step text,p_anchor timestamptz,p_due timestamptz,p_revision integer,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('marketing-user:'||p_user,0));
  if not exists(select 1 from public.marketing_automation_runtime where enabled and template_digest=p_digest)
    or p_anchor>now() or p_anchor<now()-interval '14 days' or p_due>now() or p_due<p_anchor then return null;end if;
  if not exists(select 1 from public.marketing_automation_subjects where user_id=p_user and consent_id=p_consent and paid_at is null and not billing_record and not payment_in_progress)
    or exists(select 1 from public.marketing_automation_jobs where user_id=p_user and (status in ('pending','processing') or sent_at>now()-interval '6 hours')) then return null;end if;
  insert into public.marketing_automation_jobs(user_id,consent_id,key,step,anchor,due_at,revision,template_digest)
    values(p_user,p_consent,p_key,p_step,p_anchor,p_due,p_revision,p_digest) on conflict do nothing returning id into target;
  return target;
end $$;

create function public.claim_marketing_automation() returns setof public.marketing_automation_jobs
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  update public.marketing_automation_jobs set status='review',reason='IDEMPOTENCY_WINDOW_EXCEEDED'
    where status in ('pending','processing') and first_attempt_at<now()-interval '23 hours';
  select id into target from public.marketing_automation_jobs
    where due_at<=now() and (status='pending' or (status='processing' and claimed_at<now()-interval '5 minutes'))
    order by due_at for update skip locked limit 1;
  if target is null then return;end if;
  return query update public.marketing_automation_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=target returning *;
end $$;

do $$ declare f text;begin
  foreach f in array array['record_marketing_automation_activity(uuid,text,text)',
    'queue_marketing_automation(uuid,uuid,text,text,timestamptz,timestamptz,integer,text)','claim_marketing_automation()'] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',f);
    execute format('grant execute on function public.%s to service_role',f);
  end loop;
end $$;

create function public.stop_marketing_automation_after_purchase() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.marketing_automation_jobs j set status='suppressed',reason='PAID_ORDER',provider_payload=null,claim_id=null
    where j.status in ('pending','processing') and exists(select 1 from auth.users u where u.id=j.user_id and lower(trim(u.email))=lower(trim(new.customer_email)));
  return new;
end $$;
revoke all on function public.stop_marketing_automation_after_purchase() from public,anon,authenticated;
create trigger stop_marketing_automation_after_purchase after insert on public.commerce_orders
  for each row execute function public.stop_marketing_automation_after_purchase();

create function public.stop_marketing_automation_after_withdrawal() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.consent_type in ('marketing_email','cookies_analytics') and (not new.accepted or new.withdrawn_at is not null) then
    update public.marketing_automation_jobs set status='suppressed',reason='CONSENT_WITHDRAWN',provider_payload=null,claim_id=null
      where user_id=new.user_id and status in ('pending','processing') and (new.consent_type='marketing_email' or key<>'welcome');
  end if;
  return new;
end $$;
revoke all on function public.stop_marketing_automation_after_withdrawal() from public,anon,authenticated;
create trigger stop_marketing_automation_after_withdrawal after insert on public.legal_consents
  for each row execute function public.stop_marketing_automation_after_withdrawal();

create function public.stop_marketing_automation_after_suppression() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.marketing_automation_jobs j set status='suppressed',reason='UNSUBSCRIBED',provider_payload=null,claim_id=null
    where j.status in ('pending','processing') and exists(select 1 from auth.users u where u.id=j.user_id and lower(trim(u.email))=new.email);
  return new;
end $$;
revoke all on function public.stop_marketing_automation_after_suppression() from public,anon,authenticated;
create trigger stop_marketing_automation_after_suppression after insert on public.email_suppressions
  for each row execute function public.stop_marketing_automation_after_suppression();

create function public.marketing_automation_stats() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(row),'[]'::jsonb) from (
    select key,count(*) filter(where status in ('pending','processing')) as pending,
      count(*) filter(where status='sent') as accepted,count(*) filter(where delivery_status='delivered') as delivered,
      count(*) filter(where status='suppressed') as suppressed,count(*) filter(where status='review' or delivery_status in ('bounced','complained','failed')) as review
    from public.marketing_automation_jobs group by key
  ) row;
$$;
revoke all on function public.marketing_automation_stats() from public,anon,authenticated;
grant execute on function public.marketing_automation_stats() to service_role;
