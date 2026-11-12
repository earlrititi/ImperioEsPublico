begin;

-- Prospective transport receipts only. No Auth foreign keys or Auth queries:
-- the Send Email hook may run inside the Auth transaction itself.
create table public.customer_mail_deliveries (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check(length(key) between 1 and 500),
  request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),
  payload_digest text not null check(payload_digest ~ '^[a-f0-9]{64}$'),
  recipient text not null check(recipient=lower(trim(recipient)) and length(recipient)<=254),
  subject text not null,
  sender text not null default '',
  flow text not null default 'application',
  stage text not null default 'send',
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','review')),
  claim_id uuid,
  claimed_at timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  provider_id text,
  delivery_status text,
  provider_delivery_confirmed_at timestamptz,
  provider_checked_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text check(error is null or error ~ '^[A-Z0-9_:-]{1,100}$')
);
create index customer_mail_deliveries_provider_idx on public.customer_mail_deliveries(provider_id) where provider_id is not null;
create index customer_mail_deliveries_recipient_idx on public.customer_mail_deliveries(recipient,created_at desc);
alter table public.customer_mail_deliveries enable row level security;
revoke all on public.customer_mail_deliveries from public,anon,authenticated;
grant select,insert,update on public.customer_mail_deliveries to service_role;

create function public.claim_customer_mail(
  p_key text,p_request_digest text,p_payload_digest text,p_recipient text,
  p_subject text,p_flow text,p_stage text,p_sender text
) returns setof public.customer_mail_deliveries
language plpgsql security definer set search_path='' as $$
declare target public.customer_mail_deliveries;
begin
  insert into public.customer_mail_deliveries(key,request_digest,payload_digest,recipient,subject,flow,stage,sender)
    values(p_key,p_request_digest,p_payload_digest,lower(trim(p_recipient)),p_subject,p_flow,p_stage,p_sender)
    on conflict(key) do nothing;
  select * into target from public.customer_mail_deliveries where key=p_key for update;
  if target.request_digest<>p_request_digest then
    raise exception 'CUSTOMER_MAIL_PAYLOAD_CHANGED';
  end if;
  if target.status='sent' then return next target;return;end if;
  if target.payload_digest<>p_payload_digest then raise exception 'CUSTOMER_MAIL_PAYLOAD_CHANGED';end if;
  if target.status='review' or target.created_at<clock_timestamp()-interval '23 hours' then
    update public.customer_mail_deliveries set status='review',claim_id=null,claimed_at=null,error='RETRY_WINDOW_EXPIRED'
      where id=target.id returning * into target;
    return next target;return;
  end if;
  if target.status='processing' and target.claimed_at>clock_timestamp()-interval '10 seconds' then return;end if;
  update public.customer_mail_deliveries set status='processing',claim_id=gen_random_uuid(),claimed_at=clock_timestamp(),
    attempts=attempts+1,error=null where id=target.id returning * into target;
  return next target;
end $$;

create function public.complete_customer_mail(p_id uuid,p_claim uuid,p_provider text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_provider is null or length(trim(p_provider))=0 then raise exception 'CUSTOMER_MAIL_PROVIDER_REQUIRED';end if;
  update public.customer_mail_deliveries set status='sent',provider_id=p_provider,delivery_status='accepted_by_provider',
    sent_at=clock_timestamp(),claim_id=null,claimed_at=null,error=null
    where id=p_id and claim_id=p_claim and status='processing';
  get diagnostics changed=row_count;
  return changed=1;
end $$;

create function public.fail_customer_mail(p_id uuid,p_claim uuid,p_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_code is null or p_code!~'^[A-Z0-9_:-]{1,100}$' then raise exception 'CUSTOMER_MAIL_ERROR_CODE_INVALID';end if;
  update public.customer_mail_deliveries set status='failed',claim_id=null,claimed_at=null,error=p_code
    where id=p_id and claim_id=p_claim and status='processing';
  get diagnostics changed=row_count;
  return changed=1;
end $$;

revoke all on function public.claim_customer_mail(text,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.complete_customer_mail(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fail_customer_mail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_customer_mail(text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.complete_customer_mail(uuid,uuid,text) to service_role;
grant execute on function public.fail_customer_mail(uuid,uuid,text) to service_role;

-- Renaming keeps the existing source OID alive for dependent views. Replace
-- the public read models in place so their OIDs and dependants are retained.
alter view public.admin_communication_source_records rename to admin_communication_legacy_source_records;
create view public.admin_communication_source_records with(security_barrier=true) as
select * from public.admin_communication_legacy_source_records
union all
select 'customer_mail_deliveries:'||m.id,'customer_mail_deliveries',m.id::text,'outbound',
 m.created_at,coalesce(m.sent_at,m.created_at),m.sent_at,m.provider_checked_at,
 m.sender,m.recipient,''::text,m.subject,'transaccional',m.flow,m.stage,m.status,
 public.admin_verified_mail_state(m.status,m.delivery_status,m.provider_delivery_confirmed_at),m.delivery_status,
 'resend',m.provider_id,null::text,m.attempts,m.error,null::text,null::text,null::text,null::text,null::boolean
from public.customer_mail_deliveries m;

create or replace view public.admin_communication_records with(security_barrier=true) as
select distinct on (case when provider_id is not null then direction||':'||provider||':'||provider_id else id end) *,
 case when source in ('marketing_subscription_notices','paid_order_admin_outbox','seo_jobs') then '' else email end as recipient_email,
 (source in ('email_logs','mailbox','customer_mail_deliveries') or (source='marketing_automation_jobs' and body_html is not null)) as subject_available
from public.admin_communication_source_records
order by (case when provider_id is not null then direction||':'||provider||':'||provider_id else id end),
 case when body_html is not null then 0 else 1 end,
 case when source='customer_mail_deliveries' then 1 else 0 end,created_at,id;

create or replace view public.admin_communication_coverage with(security_barrier=true) as
select source,count(*) as records,min(created_at) as history_from,max(occurred_at) as latest_record,
 max(last_provider_check) as last_provider_check,
 count(*) filter(where provider_id is not null) as provider_identified,
 count(*) filter(where state='delivered') as confirmed_delivered
from public.admin_communication_source_records group by source;

revoke all on public.admin_communication_source_records,public.admin_communication_records,public.admin_communication_coverage from public,anon,authenticated;
grant select on public.admin_communication_source_records,public.admin_communication_records,public.admin_communication_coverage to service_role;

-- Audience and consent models deliberately remain unchanged.

-- The admin enters this credential directly in the protected application.
-- Vault encrypts it; only service_role may invoke these fixed-purpose helpers.
create function public.read_corporate_mailbox_secret() returns text
language sql security definer set search_path='' as $$
  select decrypted_secret from vault.decrypted_secrets where name='imperio_corporate_imap_password' limit 1;
$$;
create function public.store_corporate_mailbox_secret(p_password text) returns void
language plpgsql security definer set search_path='' as $$
declare secret_id uuid;
begin
  if p_password is null or length(p_password)<1 or length(p_password)>4096 then raise exception 'MAILBOX_CREDENTIAL_INVALID';end if;
  select id into secret_id from vault.secrets where name='imperio_corporate_imap_password';
  if secret_id is null then
    perform vault.create_secret(p_password,'imperio_corporate_imap_password','Corporate IMAP; application uses EXAMINE/read-only TLS');
  else
    perform vault.update_secret(secret_id,p_password,'imperio_corporate_imap_password','Corporate IMAP; application uses EXAMINE/read-only TLS');
  end if;
end $$;
revoke all on function public.read_corporate_mailbox_secret() from public,anon,authenticated;
revoke all on function public.store_corporate_mailbox_secret(text) from public,anon,authenticated;
grant execute on function public.read_corporate_mailbox_secret() to service_role;
grant execute on function public.store_corporate_mailbox_secret(text) to service_role;
commit;
