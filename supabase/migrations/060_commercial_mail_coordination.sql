-- Shared commercial decisions over the existing queues and transport ledger.
-- No historical enrollment, provider call, runtime activation or Auth retention change.
begin;

alter table public.marketing_automation_runtime
  add column recovery_activity_starts_at timestamptz,
  add column commercial_paused boolean not null default false,
  add column commercial_paused_kinds text[] not null default '{}'
    check(commercial_paused_kinds <@ array['checkout','cart','viewed_product','welcome','editorial','post_delivery_loyalty','site']::text[]),
  add column commercial_frequency_enabled boolean not null default true,
  add column commercial_daily_limit integer not null default 1 check(commercial_daily_limit between 1 and 10),
  add column commercial_daily_hours integer not null default 24 check(commercial_daily_hours between 1 and 168),
  add column commercial_weekly_limit integer not null default 3 check(commercial_weekly_limit between 1 and 50),
  add column commercial_weekly_hours integer not null default 168 check(commercial_weekly_hours between 24 and 720);
-- Preserve the existing approved recovery cohort when a welcome revision is
-- reviewed later; this does not enable a runtime or enroll any identity.
update public.marketing_automation_runtime set recovery_activity_starts_at=approved_at;
alter table public.marketing_automation_jobs
  add column identity_email text check(identity_email=lower(trim(identity_email))),
  add column next_attempt_at timestamptz not null default now();
alter table public.email_logs add column next_attempt_at timestamptz not null default now();
alter table public.email_logs add column purpose text not null default 'commercial'
 constraint email_logs_purpose_check check(purpose in('commercial','service') and (purpose='commercial' or type='individual'));
alter table public.post_delivery_jobs add column next_attempt_at timestamptz not null default now();
alter table public.customer_mail_deliveries
  add column commercial_source text check(commercial_source in('automation','admin','post_delivery')),
  add column commercial_job_id uuid,
  add column commercial_priority integer,
  add constraint commercial_receipt_identity check((commercial_source is null)=(commercial_job_id is null));
create unique index customer_mail_commercial_job on public.customer_mail_deliveries(commercial_source,commercial_job_id)
  where commercial_source is not null;
create index marketing_identity_history on public.marketing_automation_jobs(identity_email,sent_at desc);

create function public.commercial_contact_state(p_email text) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'paid_at',(select max(paid_at) from public.commerce_orders where lower(trim(customer_email))=lower(trim(p_email))),
 'billing_record',exists(select 1 from public.subscriptions s where lower(trim(s.email))=lower(trim(p_email)) and s.status<>'legacy_unverified'),
 'payment_in_progress',exists(select 1 from public.reservations r join public.reservation_payment_attempts pa on pa.reservation_id=r.id
   where lower(trim(r.customer_email))=lower(trim(p_email)) and pa.status='OPEN'),
 'active_subscription',exists(select 1 from public.subscriptions s where lower(trim(s.email))=lower(trim(p_email)) and s.status in('active','trialing'))
);
$$;
create function public.commercial_automation_history(p_email text)
returns table(key text,step text,anchor timestamptz,sent_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if (select count(*) from public.marketing_automation_jobs j left join auth.users u on u.id=j.user_id
   left join public.profiles p on p.id=j.user_id where j.status='sent'
     and lower(trim(coalesce(j.identity_email,j.contact_email,u.email,p.email)))=lower(trim(p_email))
     and (j.key='welcome' or j.sent_at>now()-interval '15 days'))>1000 then
  raise exception 'COMMERCIAL_HISTORY_REQUIRES_REVIEW';
 end if;
 return query select j.key,j.step,j.anchor,j.sent_at from public.marketing_automation_jobs j
 left join auth.users u on u.id=j.user_id left join public.profiles p on p.id=j.user_id
 where j.status='sent' and lower(trim(coalesce(j.identity_email,j.contact_email,u.email,p.email)))=lower(trim(p_email))
   and (j.key='welcome' or j.sent_at>now()-interval '15 days')
 order by j.sent_at,j.id;
end;
$$;
create function public.commercial_mail_priority(p_kind text) returns integer
language sql immutable set search_path='' as $$
 select case p_kind when 'checkout' then 20 when 'cart' then 30 when 'viewed_product' then 40
   when 'welcome' then 50 when 'editorial' then 60 when 'post_delivery_loyalty' then 70 when 'site' then 80 else 90 end;
$$;

create function public.commercial_automation_eligible(p_job uuid,p_version text) returns boolean
language sql stable security definer set search_path='' as $$
select exists(
 select 1 from public.marketing_automation_jobs j
 left join auth.users u on u.id=j.user_id
 join public.marketing_email_contacts c on c.email=lower(trim(coalesce(j.identity_email,j.contact_email,u.email))) and c.consent_id=j.consent_id
 cross join lateral(select public.commercial_contact_state(c.email) as facts) f
 left join public.marketing_automation_subjects s on s.user_id=j.user_id
 where j.id=p_job and exists(select 1 from public.marketing_automation_runtime r
   where r.enabled and r.template_digest=j.template_digest and r.enrollment_starts_at<=now()
     and (j.key='welcome' or j.anchor>=coalesce(r.recovery_activity_starts_at,r.approved_at))) and (
   (j.key='welcome' and (j.step<>'day8' or (f.facts->>'paid_at' is null
       and not (f.facts->>'billing_record')::boolean and not (f.facts->>'payment_in_progress')::boolean))
     and (j.step<>'day12' or (not (f.facts->>'active_subscription')::boolean
       and not (f.facts->>'payment_in_progress')::boolean and not (f.facts->>'billing_record')::boolean)))
   or (j.key<>'welcome' and f.facts->>'paid_at' is null and not (f.facts->>'billing_record')::boolean
     and not (f.facts->>'payment_in_progress')::boolean and s.analytics_accepted and s.analytics_withdrawn_at is null
     and s.analytics_version=p_version and s.analytics_at between now()-interval '365 days' and now()
     and j.key=case when s.checkout_at between s.marketing_accepted_at and now() then 'checkout'
       when s.cart_at between s.marketing_accepted_at and now() then 'cart'
       when s.product_at between s.marketing_accepted_at and now() then 'viewed_product' else 'site' end
     and j.anchor=case j.key when 'checkout' then s.checkout_at when 'cart' then s.cart_at
       when 'viewed_product' then s.product_at else s.visited_at end)
 ) and not exists(select 1 from public.commercial_automation_history(c.email) h where j.key='welcome' and h.key='welcome' and h.step=j.step)
);
$$;

-- Group by source job, so source acceptance and its transport receipt count once.
create view public.commercial_mail_history with(security_barrier=true) as
select source,job_id,email,max(occurred_at) as occurred_at from (
 select 'automation'::text as source,j.id as job_id,lower(trim(coalesce(j.identity_email,j.contact_email,u.email,p.email))) as email,j.sent_at as occurred_at
 from public.marketing_automation_jobs j left join auth.users u on u.id=j.user_id left join public.profiles p on p.id=j.user_id where j.status='sent' and j.sent_at is not null
 union all select 'admin',e.id,lower(trim(e.recipient)),e.sent_at from public.email_logs e where e.type<>'test' and e.purpose='commercial' and e.status='sent' and e.sent_at is not null
 union all select 'post_delivery',j.id,lower(trim(j.recipient)),j.sent_at from public.post_delivery_jobs j where j.kind='post_delivery_loyalty' and j.status='sent' and j.sent_at is not null
 union all select m.commercial_source,m.commercial_job_id,m.recipient,coalesce(m.sent_at,m.created_at)
 from public.customer_mail_deliveries m where m.commercial_source is not null and m.status in('processing','sent','failed','review')
) h where email is not null group by source,job_id,email;
revoke all on public.commercial_mail_history from public,anon,authenticated;
grant select on public.commercial_mail_history to service_role;

create function public.defer_commercial_mail(p_source text,p_job uuid,p_claim uuid,p_until timestamptz,p_reason text,p_action text default 'deferred') returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_source='automation' then
  update public.marketing_automation_jobs set status=case p_action when 'suppressed' then 'suppressed' when 'review' then 'review' else 'pending' end,
   claim_id=null,claimed_at=null,next_attempt_at=coalesce(p_until,next_attempt_at),reason=p_reason,
   provider_payload=case when p_action='suppressed' then null else provider_payload end where id=p_job and claim_id=p_claim and status='processing';
 elsif p_source='admin' then
  update public.email_logs set status=case p_action when 'suppressed' then 'suppressed' when 'review' then 'review' else 'pending' end,
   claim_id=null,claimed_at=null,next_attempt_at=coalesce(p_until,next_attempt_at),error=p_reason,
   provider_payload=case when p_action='suppressed' then null else provider_payload end where id=p_job and claim_id=p_claim and status='processing';
 elsif p_source='post_delivery' then
  update public.post_delivery_jobs set status=case p_action when 'suppressed' then 'cancelled' when 'review' then 'review' else 'pending' end,
   claim_id=null,claimed_at=null,next_attempt_at=coalesce(p_until,next_attempt_at),last_error=p_reason where id=p_job and claim_id=p_claim and status='processing';
 else raise exception 'COMMERCIAL_SOURCE_INVALID';end if;
end $$;

create function public.reserve_commercial_mail(p_source text,p_job uuid,p_claim uuid,p_digest text,p_analytics_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare recipient_email text; kind text; subject text; priority integer; valid boolean; receipt public.customer_mail_deliveries;
 policy public.marketing_automation_runtime; retry_at timestamptz; daily_at timestamptz; weekly_at timestamptz; stamp timestamptz:=clock_timestamp();
begin
 if p_digest is null or p_digest!~'^[a-f0-9]{64}$' then raise exception 'COMMERCIAL_DIGEST_INVALID';end if;
 if p_source='automation' then
  select lower(trim(coalesce(j.identity_email,j.contact_email,u.email))),j.key,coalesce(j.provider_payload->>'subject','Automatizacion')
    into recipient_email,kind,subject from public.marketing_automation_jobs j left join auth.users u on u.id=j.user_id
    where j.id=p_job and j.status='processing' and j.claim_id=p_claim and j.claimed_at>stamp-interval '5 minutes';
 elsif p_source='admin' then
  select lower(trim(e.recipient)),'editorial',e.subject into recipient_email,kind,subject from public.email_logs e
    where e.id=p_job and e.type<>'test' and e.purpose='commercial' and e.status='processing' and e.claim_id=p_claim and e.claimed_at>stamp-interval '5 minutes';
 elsif p_source='post_delivery' then
  select lower(trim(j.recipient)),j.kind,'Gracias por compartir nuestra historia' into recipient_email,kind,subject from public.post_delivery_jobs j
    where j.id=p_job and j.kind='post_delivery_loyalty' and j.status='processing' and j.claim_id=p_claim and j.claimed_at>stamp-interval '5 minutes';
 else raise exception 'COMMERCIAL_SOURCE_INVALID';end if;
 if recipient_email is null then return jsonb_build_object('action','suppressed','reason','LEASE_CHANGED');end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-email:'||recipient_email,0));
 select * into receipt from public.customer_mail_deliveries where commercial_source=p_source and commercial_job_id=p_job for update;
 -- An already accepted result is reconciled locally, never transmitted again.
 if found and receipt.status='sent' then
  return jsonb_build_object('action','accepted','provider_id',receipt.provider_id,'receipt_id',receipt.id);
 end if;
 select * into policy from public.marketing_automation_runtime where id=true;
 if not found then
  perform public.defer_commercial_mail(p_source,p_job,p_claim,null,'COMMERCIAL_POLICY_UNAVAILABLE','review');
  return jsonb_build_object('action','review','reason','COMMERCIAL_POLICY_UNAVAILABLE');
 end if;
 if policy.commercial_paused or kind=any(policy.commercial_paused_kinds) then
  retry_at:=stamp+interval '1 hour';
  perform public.defer_commercial_mail(p_source,p_job,p_claim,retry_at,'COMMERCIAL_PAUSED');
  return jsonb_build_object('action','deferred','reason','COMMERCIAL_PAUSED','retry_at',retry_at);
 end if;
 -- Re-read after the recipient lock; the preliminary lookup only chooses the lock.
 valid:=exists(select 1 from public.marketing_email_contacts c where c.email=recipient_email);
 if p_source='automation' then valid:=valid and public.commercial_automation_eligible(p_job,p_analytics_version)
   and exists(select 1 from public.marketing_automation_jobs where id=p_job and claim_id=p_claim and status='processing');
 elsif p_source='admin' then valid:=valid and exists(select 1 from public.email_logs e
   where e.id=p_job and e.claim_id=p_claim and e.status='processing'
     and (e.campaign_id is null or exists(select 1 from public.newsletter_campaigns c where c.id=e.campaign_id and c.status='sending')));
 else valid:=valid and exists(select 1 from public.post_delivery_jobs j join public.commerce_orders o on o.id=j.order_id
   where j.id=p_job and j.claim_id=p_claim and j.status='processing' and o.customer_received_at is not null
     and lower(trim(o.customer_email))=recipient_email and o.status not in('CANCELLED','REFUNDED') and o.refunded_amount=0
     and o.delivery_issue_at is null and o.delivery_returned_at is null and o.delivery_disputed_at is null and o.delivery_paused_at is null);end if;
 if not coalesce(valid,false) then
  perform public.defer_commercial_mail(p_source,p_job,p_claim,null,'NO_LONGER_ELIGIBLE','suppressed');
  return jsonb_build_object('action','suppressed','reason','NO_LONGER_ELIGIBLE');end if;
 select * into receipt from public.customer_mail_deliveries where commercial_source=p_source and commercial_job_id=p_job for update;
 if receipt.id is not null then
  if receipt.status='sent' then return jsonb_build_object('action','accepted','provider_id',receipt.provider_id,'receipt_id',receipt.id);end if;
  if receipt.status='processing' and receipt.claimed_at>stamp-interval '5 minutes' then
   return jsonb_build_object('action','deferred','reason','COMMERCIAL_ATTEMPT_IN_FLIGHT',
     'retry_at',receipt.claimed_at+interval '5 minutes');
  end if;
  if receipt.payload_digest<>p_digest or receipt.created_at<stamp-interval '23 hours' or receipt.status='review' or receipt.attempts>=5 then
   update public.customer_mail_deliveries set status='review',claim_id=null,claimed_at=null,error='COMMERCIAL_RETRY_REQUIRES_REVIEW' where id=receipt.id;
   perform public.defer_commercial_mail(p_source,p_job,p_claim,null,'COMMERCIAL_RETRY_REQUIRES_REVIEW','review');
   return jsonb_build_object('action','review','reason','COMMERCIAL_RETRY_REQUIRES_REVIEW');end if;
  -- The same source job may retry; other jobs cannot borrow an uncertain slot.
 else
  priority:=public.commercial_mail_priority(kind);
  -- Eligible higher priority queued work wins independently of worker invocation order.
  if exists(select 1 from public.marketing_automation_jobs j left join auth.users u on u.id=j.user_id
    where lower(trim(coalesce(j.identity_email,j.contact_email,u.email)))=recipient_email and j.id<>p_job
      and j.status in('pending','processing') and j.due_at<=stamp and j.next_attempt_at<=stamp
      and not j.key=any(policy.commercial_paused_kinds)
      and public.commercial_mail_priority(j.key)<priority and public.commercial_automation_eligible(j.id,p_analytics_version)) then
    retry_at:=stamp+interval '5 minutes';
  end if;
  if priority>60 and not 'editorial'=any(policy.commercial_paused_kinds) and exists(select 1 from public.email_logs e
    where lower(trim(e.recipient))=recipient_email and e.type<>'test' and e.purpose='commercial' and e.status in('pending','processing','failed')
      and e.next_attempt_at<=stamp and (e.first_attempt_at is null or e.first_attempt_at>stamp-interval '23 hours')
      and (e.campaign_id is null or exists(select 1 from public.newsletter_campaigns c where c.id=e.campaign_id and c.status='sending')))
  then retry_at:=stamp+interval '5 minutes';end if;
  if priority>70 and not 'post_delivery_loyalty'=any(policy.commercial_paused_kinds) and exists(select 1 from public.post_delivery_jobs j join public.commerce_orders o on o.id=j.order_id
    where j.recipient=recipient_email and j.kind='post_delivery_loyalty' and j.status in('pending','processing')
      and j.next_attempt_at<=stamp and j.due_at<=stamp and o.customer_received_at is not null
      and o.status not in('CANCELLED','REFUNDED') and o.refunded_amount=0 and o.delivery_issue_at is null
      and o.delivery_returned_at is null and o.delivery_disputed_at is null and o.delivery_paused_at is null)
  then retry_at:=stamp+interval '5 minutes';end if;
  -- Unknown provider outcomes keep ownership until reconciliation, including
  -- after the provider idempotency window. Frequency-off cannot bypass this.
  if exists(select 1 from public.customer_mail_deliveries m where m.recipient=recipient_email
      and m.commercial_source is not null and m.status in('processing','failed','review')) then
    retry_at:=greatest(retry_at,stamp+interval '1 hour');
  end if;
  if policy.commercial_frequency_enabled then
   select h.occurred_at+make_interval(hours=>policy.commercial_daily_hours) into daily_at from public.commercial_mail_history h
    where h.email=recipient_email and h.occurred_at>stamp-make_interval(hours=>policy.commercial_daily_hours)
    order by h.occurred_at desc offset policy.commercial_daily_limit-1 limit 1;
   select h.occurred_at+make_interval(hours=>policy.commercial_weekly_hours) into weekly_at from public.commercial_mail_history h
    where h.email=recipient_email and h.occurred_at>stamp-make_interval(hours=>policy.commercial_weekly_hours)
    order by h.occurred_at desc offset policy.commercial_weekly_limit-1 limit 1;
   retry_at:=greatest(retry_at,daily_at,weekly_at);
  end if;
  if retry_at>stamp then
   perform public.defer_commercial_mail(p_source,p_job,p_claim,retry_at,'COMMERCIAL_DEFERRED');
   return jsonb_build_object('action','deferred','reason','COMMERCIAL_DEFERRED','retry_at',retry_at);end if;
  insert into public.customer_mail_deliveries(key,request_digest,payload_digest,recipient,subject,flow,stage,status,commercial_source,commercial_job_id,commercial_priority)
    values('commercial:'||p_source||':'||p_job,p_digest,p_digest,recipient_email,left(subject,250),'commercial_'||p_source,kind,'pending',p_source,p_job,priority) returning * into receipt;
 end if;
 update public.customer_mail_deliveries set status='processing',claim_id=gen_random_uuid(),claimed_at=stamp,attempts=attempts+1,error=null
   where id=receipt.id returning * into receipt;
 if p_source='automation' then update public.marketing_automation_jobs set first_attempt_at=coalesce(first_attempt_at,stamp),attempts=attempts+1 where id=p_job and claim_id=p_claim and status='processing';
 elsif p_source='admin' then update public.email_logs set first_attempt_at=coalesce(first_attempt_at,stamp),attempts=attempts+1 where id=p_job and claim_id=p_claim and status='processing';
 else update public.post_delivery_jobs set first_attempt_at=coalesce(first_attempt_at,stamp),attempts=attempts+1 where id=p_job and claim_id=p_claim and status='processing';end if;
 return jsonb_build_object('action','send','receipt_id',receipt.id,'receipt_claim_id',receipt.claim_id);
end $$;

-- Deferred work remains in its original queue; claiming is not a provider attempt.
create or replace function public.claim_marketing_automation() returns setof public.marketing_automation_jobs
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 update public.marketing_automation_jobs set status='review',reason='IDEMPOTENCY_WINDOW_EXCEEDED',claim_id=null
  where status in('pending','processing') and first_attempt_at<now()-interval '23 hours'
    and not exists(select 1 from public.customer_mail_deliveries m where m.commercial_source='automation'
      and m.commercial_job_id=marketing_automation_jobs.id and m.status='sent');
 select id into target from public.marketing_automation_jobs where contact_email is null and due_at<=now() and next_attempt_at<=now()
  and(status='pending' or(status='processing' and claimed_at<now()-interval '5 minutes')) order by due_at,id for update skip locked limit 1;
 if target is null then return;end if;
 return query update public.marketing_automation_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now() where id=target returning *;
end $$;
create or replace function public.claim_contact_welcome() returns setof public.marketing_automation_jobs
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 update public.marketing_automation_jobs set status='review',reason='IDEMPOTENCY_WINDOW_EXCEEDED',claim_id=null
  where contact_email is not null and status in('pending','processing') and first_attempt_at<now()-interval '23 hours'
    and not exists(select 1 from public.customer_mail_deliveries m where m.commercial_source='automation'
      and m.commercial_job_id=marketing_automation_jobs.id and m.status='sent');
 select id into target from public.marketing_automation_jobs where contact_email is not null and key='welcome' and due_at<=now() and next_attempt_at<=now()
  and(status='pending' or(status='processing' and claimed_at<now()-interval '5 minutes')) order by due_at,id for update skip locked limit 1;
 if target is null then return;end if;
 return query update public.marketing_automation_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now() where id=target returning *;
end $$;
create or replace function public.claim_admin_mail() returns setof public.email_logs
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 update public.email_logs set status='review',error='Automatic retry window exceeded',claim_id=null
  where status in('pending','processing','failed') and first_attempt_at<now()-interval '23 hours'
    and not exists(select 1 from public.customer_mail_deliveries m where m.commercial_source='admin'
      and m.commercial_job_id=email_logs.id and m.status='sent');
 select id into target from public.email_logs where next_attempt_at<=now() and(status='pending' or(status in('processing','failed') and claimed_at<now()-interval '5 minutes'))
  order by created_at,id for update skip locked limit 1;
 if target is null then return;end if;
 return query update public.email_logs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
  first_attempt_at=case when type='test' or purpose='service' then coalesce(first_attempt_at,now()) else first_attempt_at end,
  attempts=attempts+case when type='test' or purpose='service' then 1 else 0 end where id=target returning *;
end $$;

-- The administrator must explicitly classify a one-to-one service response.
-- Campaigns remain commercial; changing purpose cannot reuse an approved job.
create or replace function public.queue_individual_mail(p_id uuid,p_actor uuid,p_recipient text,p_type text,p_content jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.email_logs; mail_purpose text:=coalesce(p_content->>'purpose','commercial');
begin
 if p_type not in('individual','test') or mail_purpose not in('commercial','service') or (mail_purpose='service' and p_type<>'individual') then raise exception 'INVALID_INPUT';end if;
 insert into public.email_logs(id,recipient,type,purpose,subject,preheader,content,cta_label,cta_url,admin_id)
 values(p_id,p_recipient,p_type,mail_purpose,p_content->>'subject',p_content->>'preheader',p_content->>'content',p_content->>'cta_label',p_content->>'cta_url',p_actor)
 on conflict(id) do nothing;
 select * into existing from public.email_logs where id=p_id;
 if existing.admin_id<>p_actor or existing.recipient<>p_recipient or existing.type<>p_type or existing.purpose<>mail_purpose
  or existing.subject<>p_content->>'subject' or existing.preheader<>p_content->>'preheader' or existing.content<>p_content->>'content'
  or existing.cta_url<>p_content->>'cta_url' or existing.cta_label<>p_content->>'cta_label' then raise exception 'REQUEST_CONFLICT';end if;
 if not exists(select 1 from public.commerce_audit where entity='email' and entity_id=p_id and action='EMAIL_QUEUED') then
  insert into public.commerce_audit(actor_id,entity_id,entity,action) values(p_actor,p_id,'email','EMAIL_QUEUED');end if;
 return p_id;
end $$;

-- Use the same verified email lock for both welcome writers, including account/contact transitions.
create or replace function public.queue_marketing_automation(p_user uuid,p_consent uuid,p_key text,p_step text,p_anchor timestamptz,p_due timestamptz,p_revision integer,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; address text; facts jsonb;
begin
 select email into address from public.marketing_automation_enrolled_subjects where user_id=p_user and consent_id=p_consent;
 if address is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-email:'||address,0));
 facts:=public.commercial_contact_state(address);
 if (p_key<>'welcome' and (facts->>'paid_at' is not null or (facts->>'billing_record')::boolean or (facts->>'payment_in_progress')::boolean))
  or (p_key='welcome' and p_step='day8' and (facts->>'paid_at' is not null or (facts->>'billing_record')::boolean or (facts->>'payment_in_progress')::boolean))
  or (p_key='welcome' and p_step='day12' and ((facts->>'active_subscription')::boolean or (facts->>'billing_record')::boolean or (facts->>'payment_in_progress')::boolean)) then return null;end if;
 if not exists(select 1 from public.marketing_automation_runtime where enabled and template_digest=p_digest and (p_key='welcome' or p_anchor>=coalesce(recovery_activity_starts_at,approved_at)))
  or p_anchor>now() or p_anchor<now()-interval '14 days' or p_due>now() or p_due<p_anchor then return null;end if;
 if p_key='welcome' and exists(select 1 from public.marketing_automation_jobs j left join auth.users u on u.id=j.user_id
  where lower(trim(coalesce(j.identity_email,j.contact_email,u.email)))=address and j.key='welcome' and j.step=p_step) then return null;end if;
 insert into public.marketing_automation_jobs(user_id,identity_email,consent_id,key,step,anchor,due_at,revision,template_digest)
  values(p_user,address,p_consent,p_key,p_step,p_anchor,p_due,p_revision,p_digest) on conflict do nothing returning id into target;
 return target;
end $$;
create or replace function public.queue_contact_welcome(p_email text,p_step text,p_due timestamptz,p_revision integer,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare contact public.marketing_email_contacts; target uuid; start_at timestamptz; address text:=lower(trim(p_email)); facts jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('marketing-email:'||address,0));
 select enrollment_starts_at into start_at from public.marketing_automation_runtime where enabled and template_digest=p_digest and enrollment_starts_at<=now();
 select * into contact from public.marketing_email_contacts where email=address;
 if start_at is null or contact.email is null or contact.marketing_accepted_at<start_at or p_due>now() or p_due<contact.welcome_at then return null;end if;
 facts:=public.commercial_contact_state(address);
 if (p_step='day8' and (facts->>'paid_at' is not null or (facts->>'billing_record')::boolean or (facts->>'payment_in_progress')::boolean))
   or (p_step='day12' and ((facts->>'active_subscription')::boolean or (facts->>'billing_record')::boolean or (facts->>'payment_in_progress')::boolean)) then return null;end if;
 if exists(select 1 from public.marketing_automation_jobs j left join auth.users u on u.id=j.user_id
  where lower(trim(coalesce(j.identity_email,j.contact_email,u.email)))=address and j.key='welcome' and j.step=p_step) then return null;end if;
 insert into public.marketing_automation_jobs(user_id,identity_email,contact_email,consent_id,key,step,anchor,due_at,revision,template_digest)
  values(contact.user_id,address,address,contact.consent_id,'welcome',p_step,contact.welcome_at,p_due,p_revision,p_digest) on conflict do nothing returning id into target;
 return target;
end $$;

create or replace function public.stop_marketing_automation_after_purchase() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.marketing_automation_jobs j set status='suppressed',reason='PAID_ORDER',provider_payload=null,claim_id=null
 where (j.key<>'welcome' or j.step='day8') and j.status in('pending','processing')
   and lower(trim(coalesce(j.identity_email,j.contact_email,(select u.email from auth.users u where u.id=j.user_id))))=lower(trim(new.customer_email));
 return new;
end $$;

-- Preserve the service branch; loyalty starts its retry clock only after reservation.
create or replace function public.claim_post_delivery_job(p_loyalty boolean) returns setof public.post_delivery_jobs
language plpgsql security definer set search_path='' as $$
declare j public.post_delivery_jobs; o public.commerce_orders;
begin
 select * into j from public.post_delivery_jobs where due_at<=now() and next_attempt_at<=now() and(kind='delivery_check' or p_loyalty)
  and(status='pending' or(status='processing' and claimed_at<now()-interval '5 minutes')) order by due_at,id limit 1;
 if not found then return;end if;
 select * into o from public.commerce_orders where id=j.order_id for update skip locked;
 if not found then return;end if;
 select * into j from public.post_delivery_jobs where id=j.id and(status='pending' or(status='processing' and claimed_at<now()-interval '5 minutes')) for update skip locked;
 if not found then return;end if;
 if j.first_attempt_at<now()-interval '23 hours' and not exists(select 1 from public.customer_mail_deliveries m
  where m.commercial_source='post_delivery' and m.commercial_job_id=j.id and m.status='sent') then
  update public.post_delivery_jobs set status='review',claim_id=null,last_error='PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED' where id=j.id;return;end if;
 if o.status in('CANCELLED','REFUNDED') or o.refunded_amount>0 or o.delivery_issue_at is not null or o.delivery_returned_at is not null or o.delivery_disputed_at is not null
  or o.delivery_paused_at is not null or lower(trim(o.customer_email))<>j.recipient
  or(j.kind='delivery_check' and(o.carrier_delivered_at is null or o.customer_received_at is not null or j.token_expires_at<=now()))
  or(j.kind='post_delivery_loyalty' and(o.customer_received_at is null or not public.post_delivery_marketing_eligible(j.recipient))) then
  update public.post_delivery_jobs set status='cancelled',claim_id=null,last_error='NO_LONGER_ELIGIBLE' where id=j.id;return;end if;
 return query update public.post_delivery_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
  first_attempt_at=case when kind='delivery_check' then coalesce(first_attempt_at,now()) else first_attempt_at end,
  attempts=attempts+case when kind='delivery_check' then 1 else 0 end where id=j.id returning *;
end $$;

-- Keep commercial receipt copies correctly classified without changing legacy rows.
create or replace function public.finish_admin_mail(p_id uuid,p_claim uuid,p_status text,p_provider_id text default null,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare campaign uuid;
begin
 if p_status not in('sent','failed','suppressed','review') then raise exception 'INVALID_INPUT';end if;
 if p_status='sent' and coalesce(trim(p_provider_id),'')='' then raise exception 'CUSTOMER_MAIL_PROVIDER_REQUIRED';end if;
 update public.email_logs set status=p_status,provider_message_id=p_provider_id,error=p_error,
   delivery_status=case when p_status='sent' then 'accepted_by_provider' else null end,
   sent_at=case when p_status='sent' then now() else null end
   where id=p_id and claim_id=p_claim and status='processing' returning campaign_id into campaign;
 if not found then raise exception 'EMAIL_RECEIPT_UNAVAILABLE';end if;
 if campaign is not null then
  perform 1 from public.newsletter_campaigns where id=campaign for update;
  if not exists(select 1 from public.email_logs where campaign_id=campaign and status in('pending','processing','failed')) then
   update public.newsletter_campaigns set status=case when exists(select 1 from public.email_logs where campaign_id=campaign and status='review') then 'review' else 'sent' end,
     sent_at=now() where id=campaign;
  end if;
 end if;
end $$;

create or replace view public.admin_communication_source_records with(security_barrier=true) as
select * from public.admin_communication_legacy_source_records
union all
select 'customer_mail_deliveries:'||m.id,'customer_mail_deliveries',m.id::text,'outbound',
 m.created_at,coalesce(m.sent_at,m.created_at),m.sent_at,m.provider_checked_at,
 m.sender,m.recipient,''::text,m.subject,case when m.commercial_source is not null then 'marketing' else 'transaccional' end,m.flow,m.stage,m.status,
 public.admin_verified_mail_state(m.status,m.delivery_status,m.provider_delivery_confirmed_at),m.delivery_status,
 'resend',m.provider_id,null::text,m.attempts,m.error,m.body_html,m.body_text,null::text,null::text,null::boolean
from public.customer_mail_deliveries m;

revoke all on function public.commercial_contact_state(text),public.commercial_automation_history(text),public.commercial_mail_priority(text),
 public.commercial_automation_eligible(uuid,text),public.defer_commercial_mail(text,uuid,uuid,timestamptz,text,text),public.reserve_commercial_mail(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.commercial_contact_state(text),public.commercial_automation_history(text),public.commercial_mail_priority(text),
 public.commercial_automation_eligible(uuid,text),public.defer_commercial_mail(text,uuid,uuid,timestamptz,text,text),public.reserve_commercial_mail(text,uuid,uuid,text,text) to service_role;
commit;
