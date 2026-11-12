-- Prospective Stripe notifications only. Disabled until an explicit cutover.
-- No Stripe requests, billing changes, historical enrollment, Auth queries or sends.
begin;

create table public.stripe_customer_mail_runtime (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  starts_at timestamptz,
  livemode boolean not null default true,
  check(not enabled or starts_at is not null)
);
insert into public.stripe_customer_mail_runtime(id) values(true);
alter table public.stripe_customer_mail_runtime enable row level security;
revoke all on public.stripe_customer_mail_runtime from public,anon,authenticated;
grant select,update on public.stripe_customer_mail_runtime to service_role;

create table public.stripe_customer_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check(key ~ '^stripe-mail:v1:[A-Za-z0-9_:-]{1,220}$'),
  event_id text not null check(event_id ~ '^evt_[A-Za-z0-9_]{1,180}$'),
  event_type text not null check(length(event_type) between 1 and 100),
  event_created_at timestamptz not null,
  livemode boolean not null,
  kind text not null check(kind in ('invoice_paid','checkout_paid','refund_pending','refund_requires_action','refund_succeeded','refund_failed','refund_canceled','invoice_payment_failed','invoice_action_required','invoice_awaiting_payment','credit_note_issued','credit_note_void','subscription_trial_ending','subscription_upcoming','subscription_cancel_scheduled','subscription_cancelled','legacy_card_expiring')),
  recipient text not null check(recipient=lower(trim(recipient)) and length(recipient) between 3 and 254),
  subject text not null check(length(subject) between 1 and 250),
  payload_digest text not null check(payload_digest ~ '^[a-f0-9]{64}$'),
  encrypted_message text check(encrypted_message is null or (length(encrypted_message) between 40 and 1048576 and encrypted_message like 'v1.%')),
  status text not null default 'pending' check(status in ('pending','processing','failed','sent','suppressed','review')),
  claim_id uuid,
  claimed_at timestamptz,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0 check(attempts>=0),
  provider_id text,
  sent_at timestamptz,
  error text check(error is null or error ~ '^[A-Z0-9_:-]{1,100}$'),
  created_at timestamptz not null default now(),
  check(status in ('sent','suppressed') or encrypted_message is not null)
);
create index stripe_customer_mail_pending_idx on public.stripe_customer_mail_outbox(next_attempt_at,created_at,id) where status in ('pending','failed','processing');
create index stripe_customer_mail_provider_idx on public.stripe_customer_mail_outbox(provider_id) where provider_id is not null;
alter table public.stripe_customer_mail_outbox enable row level security;
revoke all on public.stripe_customer_mail_outbox from public,anon,authenticated;
grant select on public.stripe_customer_mail_outbox to service_role;

create function public.enqueue_stripe_customer_mail(
  p_key text,p_event_id text,p_event_type text,p_event_created_at timestamptz,p_livemode boolean,
  p_kind text,p_recipient text,p_subject text,p_payload_digest text,p_encrypted_message text
) returns boolean language plpgsql security definer set search_path='' as $$
declare runtime public.stripe_customer_mail_runtime; changed integer;
begin
  select * into runtime from public.stripe_customer_mail_runtime where id=true for share;
  if runtime.enabled is not true or runtime.starts_at is null or p_livemode is distinct from runtime.livemode
    or p_event_created_at<runtime.starts_at or p_event_created_at>clock_timestamp()+interval '5 minutes' then return false;end if;
  if p_event_created_at is null or p_recipient is null or p_recipient!~'^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$'
    or p_subject~'[\r\n]' then raise exception 'STRIPE_MAIL_INPUT_INVALID';end if;
  -- Business identity wins over later event IDs, changed renderers or customer edits.
  -- A duplicate never replaces an already frozen provider payload.
  insert into public.stripe_customer_mail_outbox(key,event_id,event_type,event_created_at,livemode,kind,recipient,subject,payload_digest,encrypted_message)
    values(p_key,p_event_id,p_event_type,p_event_created_at,p_livemode,p_kind,lower(trim(p_recipient)),p_subject,p_payload_digest,p_encrypted_message)
    on conflict(key) do nothing;
  get diagnostics changed=row_count;
  return changed=1;
end $$;

create function public.claim_stripe_customer_mail() returns setof public.stripe_customer_mail_outbox
language plpgsql security definer set search_path='' as $$
declare runtime public.stripe_customer_mail_runtime; target public.stripe_customer_mail_outbox;
begin
  select * into runtime from public.stripe_customer_mail_runtime where id=true for share;
  if runtime.enabled is not true or runtime.starts_at is null or runtime.starts_at>clock_timestamp() then return;end if;
  update public.stripe_customer_mail_outbox set status='review',claim_id=null,claimed_at=null,error='RETRY_WINDOW_EXPIRED'
    where status in ('pending','failed','processing') and first_attempt_at<clock_timestamp()-interval '23 hours';
  update public.stripe_customer_mail_outbox set status='suppressed',claim_id=null,claimed_at=null,encrypted_message=null,error='OUTSIDE_ACTIVE_SCOPE'
    where status in ('pending','failed','processing') and (status<>'processing' or claimed_at<clock_timestamp()-interval '5 minutes')
      and (event_created_at<runtime.starts_at or livemode is distinct from runtime.livemode);
  select * into target from public.stripe_customer_mail_outbox
    where next_attempt_at<=clock_timestamp() and event_created_at>=runtime.starts_at and livemode=runtime.livemode
      and (status in ('pending','failed') or (status='processing' and claimed_at<clock_timestamp()-interval '5 minutes'))
    order by created_at,id for update skip locked limit 1;
  if target.id is null then return;end if;
  return query update public.stripe_customer_mail_outbox set status='processing',claim_id=gen_random_uuid(),claimed_at=clock_timestamp(),
    first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),attempts=attempts+1,error=null
    where id=target.id returning *;
end $$;

create function public.stripe_customer_mail_can_send(p_id uuid,p_claim uuid) returns boolean
language sql security definer set search_path='' as $$
  select exists(select 1 from public.stripe_customer_mail_outbox j cross join public.stripe_customer_mail_runtime r
    where r.id=true and r.enabled and r.starts_at is not null and r.starts_at<=clock_timestamp()
      and j.id=p_id and j.claim_id=p_claim and j.status='processing' and j.claimed_at>clock_timestamp()-interval '5 minutes'
      and j.first_attempt_at>clock_timestamp()-interval '23 hours' and j.event_created_at>=r.starts_at and j.livemode=r.livemode);
$$;

create function public.complete_stripe_customer_mail(p_id uuid,p_claim uuid,p_provider text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_provider is null or length(trim(p_provider))=0 then raise exception 'STRIPE_MAIL_PROVIDER_REQUIRED';end if;
  update public.stripe_customer_mail_outbox set status='sent',provider_id=p_provider,sent_at=clock_timestamp(),
    claim_id=null,claimed_at=null,encrypted_message=null,error=null where id=p_id and claim_id=p_claim and status='processing';
  get diagnostics changed=row_count;return changed=1;
end $$;

create function public.fail_stripe_customer_mail(p_id uuid,p_claim uuid,p_code text,p_retry boolean default true) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_code is null or p_code!~'^[A-Z0-9_:-]{1,100}$' then raise exception 'STRIPE_MAIL_ERROR_CODE_INVALID';end if;
  update public.stripe_customer_mail_outbox set status=case when p_retry and first_attempt_at>clock_timestamp()-interval '23 hours' then 'failed' else 'review' end,
    claim_id=null,claimed_at=null,error=p_code,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*power(2,least(attempts,6))::integer))
    where id=p_id and claim_id=p_claim and status='processing';
  get diagnostics changed=row_count;return changed=1;
end $$;

create function public.suppress_stripe_customer_mail(p_id uuid,p_claim uuid,p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_code is null or p_code!~'^[A-Z0-9_:-]{1,100}$' then raise exception 'STRIPE_MAIL_ERROR_CODE_INVALID';end if;
  update public.stripe_customer_mail_outbox set status='suppressed',claim_id=null,claimed_at=null,encrypted_message=null,error=p_code
    where id=p_id and claim_id=p_claim and status='processing';
  get diagnostics changed=row_count;return changed=1;
end $$;

revoke all on function public.enqueue_stripe_customer_mail(text,text,text,timestamptz,boolean,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_stripe_customer_mail() from public,anon,authenticated;
revoke all on function public.stripe_customer_mail_can_send(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_stripe_customer_mail(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fail_stripe_customer_mail(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.suppress_stripe_customer_mail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_stripe_customer_mail(text,text,text,timestamptz,boolean,text,text,text,text,text) to service_role;
grant execute on function public.claim_stripe_customer_mail() to service_role;
grant execute on function public.stripe_customer_mail_can_send(uuid,uuid) to service_role;
grant execute on function public.complete_stripe_customer_mail(uuid,uuid,text) to service_role;
grant execute on function public.fail_stripe_customer_mail(uuid,uuid,text,boolean) to service_role;
grant execute on function public.suppress_stripe_customer_mail(uuid,uuid,text) to service_role;
commit;
