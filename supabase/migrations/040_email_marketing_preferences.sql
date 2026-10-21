alter table public.manifesto_requests add column resource text not null default 'manifesto'
  check(resource in ('manifesto','seven_stories'));

create table public.account_email_preferences(
  email text primary key check(email=lower(trim(email))),
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted boolean not null,
  consent_id uuid not null references public.legal_consents(id),
  updated_at timestamptz not null
);
alter table public.account_email_preferences enable row level security;
revoke all on public.account_email_preferences from public,anon,authenticated;
grant select,insert,update on public.account_email_preferences to service_role;

-- Only a new explicit choice by the verified owner can supersede old withdrawals.
-- Provider complaints, bounces and manual blocks always remain effective.
create view public.marketing_suppressed_contacts with(security_barrier=true) as
select email from public.email_suppressions
union select email from public.account_email_preferences where not accepted
union select lower(trim(r.customer_email)) from public.reservations r where r.marketing_withdrawn_at is not null
  and not exists(select 1 from public.account_email_preferences p join auth.users u on u.id=p.user_id
    where p.email=lower(trim(r.customer_email)) and p.accepted and p.updated_at>r.marketing_withdrawn_at
    and lower(trim(u.email))=p.email and u.email_confirmed_at is not null and u.deleted_at is null)
union select lower(trim(pr.email)) from public.legal_consents c join public.profiles pr on pr.id=c.user_id
  where c.consent_type='marketing_email' and (not c.accepted or c.withdrawn_at is not null)
  and not exists(select 1 from public.account_email_preferences p join auth.users u on u.id=p.user_id
    where p.email=lower(trim(pr.email)) and p.accepted and p.updated_at>coalesce(c.withdrawn_at,c.created_at)
    and lower(trim(u.email))=p.email and u.email_confirmed_at is not null and u.deleted_at is null);
revoke all on public.marketing_suppressed_contacts from public,anon,authenticated;
grant select on public.marketing_suppressed_contacts to service_role;

create or replace view public.marketing_automation_subjects with(security_barrier=true) as
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
  and not exists(select 1 from public.marketing_suppressed_contacts s where s.email=lower(trim(u.email)));

-- Historical accounts join only after an explicit new account preference, never
-- because the operator expands a campaign audience or enables a flag.
create or replace view public.marketing_automation_enrolled_subjects with(security_barrier=true) as
select s.* from public.marketing_automation_subjects s
join auth.users u on u.id=s.user_id cross join public.marketing_automation_runtime r
where r.enabled and r.enrollment_starts_at is not null and r.enrollment_starts_at<=now()
  and (u.created_at>=r.enrollment_starts_at or exists(select 1 from public.account_email_preferences p
    where p.user_id=s.user_id and p.email=s.email and p.accepted and p.consent_id=s.consent_id and p.updated_at>=r.enrollment_starts_at));
revoke all on public.marketing_automation_subjects,public.marketing_automation_enrolled_subjects from public,anon,authenticated;
grant select on public.marketing_automation_subjects,public.marketing_automation_enrolled_subjects to service_role;

create or replace function public.get_account_email_preference(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target auth.users; pref public.account_email_preferences; proof public.legal_consents; eligible boolean; hard boolean;
begin
  select * into target from auth.users where id=p_user and deleted_at is null;
  if target.id is null then raise exception 'UNAUTHORIZED';end if;
  select * into pref from public.account_email_preferences where email=lower(trim(target.email));
  select * into proof from public.legal_consents where user_id=p_user and consent_type='marketing_email' order by created_at desc,id desc limit 1;
  hard:=exists(select 1 from public.email_suppressions where email=lower(trim(target.email)) and reason<>'unsubscribe');
  eligible:=target.email_confirmed_at is not null and not exists(select 1 from public.marketing_suppressed_contacts where email=lower(trim(target.email))) and (
    coalesce(pref.accepted,false) or (coalesce(proof.accepted,false) and proof.withdrawn_at is null)
    or exists(select 1 from public.manifesto_requests where email=lower(trim(target.email)) and status='accepted' and marketing_consent)
    or exists(select 1 from public.marketing_leads where email=lower(trim(target.email)) and marketing_accepted_at is not null)
    or exists(select 1 from public.reservations where lower(trim(customer_email))=lower(trim(target.email)) and marketing_consent and marketing_withdrawn_at is null));
  return jsonb_build_object('active',eligible,'verified',target.email_confirmed_at is not null,'blocked',hard,
    'updatedAt',coalesce(pref.updated_at,proof.created_at));
end $$;

create or replace function public.set_account_email_preference(p_user uuid,p_accepted boolean,p_version text,p_copy_version text,p_copy text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target auth.users; stamp timestamptz; consent uuid; state jsonb;
begin
  select * into target from auth.users where id=p_user and deleted_at is null and email_confirmed_at is not null
    and (banned_until is null or banned_until<now());
  if target.id is null then raise exception 'UNAUTHORIZED';end if;
  if p_accepted is null or p_version is null or p_copy_version is null or p_copy is null or p_version!~'^\d{4}-\d{2}-\d{2}$' or p_copy_version!~'^\d{4}-\d{2}-\d{2}$' or length(p_copy) not between 10 and 500 then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtextextended('marketing-email:'||lower(trim(target.email)),0));
  state:=public.get_account_email_preference(p_user);
  if p_accepted and (state->>'blocked')::boolean then raise exception 'EMAIL_BLOCKED';end if;
  if p_accepted=(state->>'active')::boolean and exists(select 1 from public.account_email_preferences where email=lower(trim(target.email)) and accepted=p_accepted) then return state;end if;
  stamp:=clock_timestamp();
  insert into public.legal_consents(user_id,consent_type,document_version,accepted,source,created_at,withdrawn_at,metadata)
    values(p_user,'marketing_email',p_version,p_accepted,'account_preferences',stamp,case when p_accepted then null else stamp end,
      jsonb_build_object('copy_version',p_copy_version,'consent_text',p_copy)) returning id into consent;
  insert into public.account_email_preferences(email,user_id,accepted,consent_id,updated_at)
    values(lower(trim(target.email)),p_user,p_accepted,consent,stamp)
    on conflict(email) do update set user_id=excluded.user_id,accepted=excluded.accepted,consent_id=excluded.consent_id,updated_at=excluded.updated_at;
  if p_accepted then
    delete from public.email_suppressions where email=lower(trim(target.email)) and reason='unsubscribe';
  else
    -- Preserve an email-level withdrawal even if the account is later deleted.
    insert into public.email_suppressions(email,reason) values(lower(trim(target.email)),'unsubscribe') on conflict(email) do nothing;
  end if;
  update public.marketing_automation_jobs set status='suppressed',reason='PREFERENCE_CHANGED',provider_payload=null,claim_id=null
    where user_id=p_user and status in ('pending','processing');
  update public.email_logs set status='suppressed',provider_payload=null,claim_id=null
    where lower(trim(recipient))=lower(trim(target.email)) and type<>'test' and status in ('pending','processing','failed');
  return public.get_account_email_preference(p_user);
end $$;

create or replace function public.suppress_marketing_email(p_email text,p_reason text default 'unsubscribe') returns void
language plpgsql security definer set search_path='' as $$
declare address text:=lower(trim(p_email));
begin
  if address is null or p_reason is null or length(address)>254 or address!~'^[^\s@]+@[^\s@]+\.[^\s@]+$' or p_reason not in ('unsubscribe','provider_bounced','provider_complained') then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtextextended('marketing-email:'||address,0));
  insert into public.email_suppressions(email,reason) values(address,p_reason)
    on conflict(email) do update set reason=case
      when email_suppressions.reason='provider_complained' then email_suppressions.reason
      when excluded.reason='provider_complained' then excluded.reason
      when email_suppressions.reason<>'unsubscribe' then email_suppressions.reason
      else excluded.reason end;
  update public.marketing_automation_jobs set status='suppressed',reason='EMAIL_SUPPRESSED',provider_payload=null,claim_id=null
    where user_id in(select id from public.profiles where lower(trim(email))=address) and status in ('pending','processing');
  update public.email_logs set status='suppressed',provider_payload=null,claim_id=null
    where lower(trim(recipient))=address and type<>'test' and status in ('pending','processing','failed');
end $$;
revoke all on function public.get_account_email_preference(uuid),public.set_account_email_preference(uuid,boolean,text,text,text),public.suppress_marketing_email(text,text) from public,anon,authenticated;
grant execute on function public.get_account_email_preference(uuid),public.set_account_email_preference(uuid,boolean,text,text,text),public.suppress_marketing_email(text,text) to service_role;

alter table public.newsletter_campaigns drop constraint newsletter_campaigns_segment_check;
alter table public.newsletter_campaigns add constraint newsletter_campaigns_segment_check
  check(segment in ('shirts','subscriptions','arcabucero','maestre_campo','both','all','manifesto','leads','community','newsletter'));
alter table public.admin_notification_history drop constraint admin_notification_history_kind_check;
alter table public.admin_notification_history add constraint admin_notification_history_kind_check
  check(kind in ('registration','checkout_interest','manifesto','newsletter','paid_subscription','paid_order'));

alter table public.funnel_runs drop constraint funnel_runs_flow_check;
alter table public.funnel_runs add constraint funnel_runs_flow_check check(flow in ('manifesto','newsletter','subscriptions','shirts'));
create or replace function public.record_funnel_step(p_id uuid,p_flow text,p_step integer,p_page text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_flow is null or p_step is null or p_page is null or p_flow not in ('manifesto','newsletter','subscriptions','shirts') or p_step<0 or p_step>(case when p_flow='shirts' then 5 else 4 end)
    or p_page !~ '^/($|newsletter/?$|manifiesto/?$|suscribirse/?$|precios/?$|instagram/?$|tienda/?$|reservas/?$|checkout/(arcabucero-(monthly|annual)|maestre-campo-(monthly|annual))/?$)' then raise exception 'INVALID_INPUT';end if;
  insert into public.funnel_runs(id,flow,page,stages) values(p_id,p_flow,p_page,jsonb_build_array(p_step))
  on conflict(id,flow) do update set
    stages=case when public.funnel_runs.stages @> jsonb_build_array(p_step) then public.funnel_runs.stages else public.funnel_runs.stages||jsonb_build_array(p_step) end,
    last_seen_at=now();
end $$;
