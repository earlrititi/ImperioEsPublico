-- Email funnel read model. Additive and read-only for the admin dashboard.
-- Provider events are recorded only from verified Resend webhooks.
begin;

create table public.email_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend' check (provider in ('resend')),
  provider_message_id text not null,
  email text not null check (email = lower(trim(email)) and length(email) <= 254),
  event_type text not null check (event_type in ('sent','delivered','delivery_delayed','opened','clicked','bounced','complained','failed','suppressed')),
  occurred_at timestamptz not null,
  url text check (url is null or length(url) <= 2048),
  detail jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index email_provider_events_email_idx on public.email_provider_events(email, occurred_at desc);
create index email_provider_events_message_idx on public.email_provider_events(provider_message_id, occurred_at desc);
alter table public.email_provider_events enable row level security;
revoke all on public.email_provider_events from public,anon,authenticated;
grant select,insert on public.email_provider_events to service_role;

-- Stripe remains the only economic source. These columns extend the existing
-- idempotency ledger with the invoice amounts that are already verified.
alter table public.stripe_webhook_events
  add column if not exists occurred_at timestamptz,
  add column if not exists customer_email text,
  add column if not exists amount_paid bigint,
  add column if not exists currency text,
  add column if not exists subscription_id text,
  add column if not exists invoice_id text,
  add column if not exists billing_reason text;
create index if not exists stripe_webhook_events_revenue_idx
  on public.stripe_webhook_events(customer_email, occurred_at desc)
  where amount_paid is not null;

-- The sequence is editable in marketing_automation_drafts. The fallback mirrors
-- AUTOMATION_DEFAULTS only to keep historical jobs readable before a draft exists.
create function public.email_funnel_step_kind(p_step text,p_sequence jsonb)
returns text language sql immutable set search_path='' as $$
  select coalesce(
    (select s->>'kind' from jsonb_array_elements(p_sequence) s where s->>'id'=p_step limit 1),
    case when p_step='day1' then 'welcome' else 'nurture' end
  )
$$;
revoke all on function public.email_funnel_step_kind(text,jsonb) from public,anon,authenticated;
grant execute on function public.email_funnel_step_kind(text,jsonb) to service_role;

create view public.admin_email_funnel_contacts with(security_barrier=true) as
with sequence as (
  select coalesce(
    (select jsonb_agg(jsonb_build_object(
       'id', step->>'id',
       'kind', case
         when coalesce(step#>>'{mail,cta_url}','') ~* '/(tienda|suscribirse|precios|checkout|carrito)(/|$|[?#])' then 'offer'
         when ordinal = 1 then 'welcome'
         else 'nurture' end,
       'after_hours', coalesce((step->>'afterHours')::numeric,0)
     ) order by ordinal)
     from public.marketing_automation_drafts d
     cross join lateral jsonb_array_elements(d.steps) with ordinality as x(step,ordinal)
     where d.key='welcome'),
    '[{"id":"day1","kind":"welcome","after_hours":0},{"id":"day3","kind":"nurture","after_hours":72},{"id":"day5","kind":"nurture","after_hours":120},{"id":"day8","kind":"offer","after_hours":192},{"id":"day12","kind":"offer","after_hours":288}]'::jsonb
  ) as steps
),
step_events as (
  select provider_message_id,
    count(*) filter(where event_type='delivered') as delivered,
    count(*) filter(where event_type='opened') as opened,
    count(*) filter(where event_type='clicked') as clicked,
    count(*) filter(where event_type='bounced') as bounced,
    count(*) filter(where event_type='complained') as complained,
    count(*) filter(where event_type='failed') as failed
  from public.email_provider_events
  where provider_message_id is not null
  group by provider_message_id
),
welcome_jobs as (
  select lower(trim(coalesce(j.contact_email,p.email,''))) as email,
    jsonb_agg(jsonb_build_object(
      'id',j.id,'step',j.step,'status',j.status,'due_at',j.due_at,'sent_at',j.sent_at,
      'delivery_status',j.delivery_status,'delivered_at',j.provider_delivery_confirmed_at,
      'reason',j.reason,'attempts',j.attempts,'provider_id',j.provider_id,
      'kind',public.email_funnel_step_kind(j.step,seq.steps),
      'events',jsonb_build_object(
        'delivered',coalesce(se.delivered,0),'opened',coalesce(se.opened,0),
        'clicked',coalesce(se.clicked,0),'bounced',coalesce(se.bounced,0),
        'complained',coalesce(se.complained,0),'failed',coalesce(se.failed,0))
    ) order by j.due_at,j.id) as jobs,
    count(*) filter(where j.status='sent') as sent_count,
    count(*) filter(where j.status in ('pending','processing')) as pending_count,
    count(*) filter(where j.provider_delivery_confirmed_at is not null) as delivered_jobs,
    max(case public.email_funnel_step_kind(j.step,seq.steps)
      when 'offer' then 3 when 'nurture' then 2 else 1 end) filter(where j.status='sent') as sent_phase,
    max(j.sent_at) filter(where j.status='sent') as last_sent_at,
    min(j.due_at) filter(where j.status in ('pending','processing')) as next_due_at
  from public.marketing_automation_jobs j
  left join public.profiles p on p.id=j.user_id
  cross join sequence seq
  left join step_events se on se.provider_message_id=j.provider_id
  where j.key='welcome'
  group by 1
),
event_totals as (
  select email,
    count(*) filter(where event_type='delivered') as delivered,
    count(*) filter(where event_type='opened') as opened,
    count(*) filter(where event_type='clicked') as clicked,
    count(*) filter(where event_type='bounced') as bounced,
    count(*) filter(where event_type='complained') as complained,
    count(*) filter(where event_type='failed') as failed,
    max(occurred_at) filter(where event_type='opened') as last_opened_at,
    max(occurred_at) filter(where event_type='clicked') as last_clicked_at
  from public.email_provider_events
  group by email
),
subscription_state as (
  select lower(trim(s.email)) as email,
    bool_or(s.status in ('active','trialing')) as active_paid,
    bool_or(s.plan='maestre_campo' and s.status in ('active','trialing')) as maestre,
    bool_or(s.plan='arcabucero' and s.status in ('active','trialing')) as arcabucero,
    max(s.billing_interval) filter(where s.status in ('active','trialing')) as interval,
    min(s.created_at) as subscribed_at,
    max(s.current_period_end) filter(where s.status in ('active','trialing')) as renews_at
  from public.subscriptions s
  where s.email is not null
  group by 1
),
subscription_revenue as (
  select email,
    coalesce(sum(amount_paid) filter(where amount_paid is not null and amount_paid>0),0)::bigint as revenue_cents,
    max(occurred_at) as last_payment_at
  from (
    -- invoice.paid and invoice.payment_succeeded can describe the same invoice:
    -- count it once, preferring the event that carries the amount.
    select distinct on (coalesce(invoice_id,event_id))
      lower(trim(customer_email)) as email,amount_paid,occurred_at
    from public.stripe_webhook_events
    where event_type in ('invoice.paid','invoice.payment_succeeded') and customer_email is not null
    order by coalesce(invoice_id,event_id),(amount_paid is not null) desc,occurred_at desc
  ) invoices
  group by email
),
shop_orders as (
  select lower(trim(o.customer_email)) as email,
    count(*) as order_count,
    coalesce(sum(greatest(o.total-o.refunded_amount,0)),0)::bigint as revenue_cents,
    max(o.paid_at) as last_order_at
  from public.commerce_orders o
  where o.status not in ('CANCELLED','REFUNDED')
  group by 1
),
checkout_state as (
  select email,max(created_at) as last_checkout_at
  from public.subscription_checkouts group by email
)
select c.email,c.name,c.created_at as captured_at,c.sources,c.state as audience_state,
  c.suppressed,c.suppression_reason,c.preference,c.verified_at,c.welcome_step,c.welcome_status,
  c.next_mail_at,c.last_mail_at,me.welcome_at,
  coalesce(w.jobs,'[]'::jsonb) as welcome_jobs,
  coalesce(w.sent_count,0)::bigint as sent_count,
  coalesce(w.pending_count,0)::bigint as pending_count,
  greatest(coalesce(e.delivered,0),coalesce(w.delivered_jobs,0))::bigint as delivered_count,
  coalesce(e.opened,0)::bigint as opened_count,
  coalesce(e.clicked,0)::bigint as clicked_count,
  coalesce(e.bounced,0)::bigint as bounced_count,
  coalesce(e.complained,0)::bigint as complained_count,
  coalesce(e.failed,0)::bigint as failed_count,
  w.last_sent_at,w.next_due_at,e.last_opened_at,e.last_clicked_at,
  seq.steps as funnel_sequence,
  case
    when coalesce(ss.active_paid,false) or coalesce(so.order_count,0)>0 then 4
    when c.suppressed or coalesce(e.bounced,0)>0 or coalesce(e.complained,0)>0 then 5
    else coalesce(w.sent_phase,0)
  end as phase,
  (coalesce(ss.active_paid,false) or coalesce(so.order_count,0)>0) as converted,
  coalesce(ss.active_paid,false) as active_paid,
  coalesce(ss.maestre,false) as maestre,
  coalesce(ss.arcabucero,false) as arcabucero,
  ss.interval as subscription_interval,
  (coalesce(so.order_count,0)>0) as buyer,
  (exists(select 1 from public.profiles p where lower(trim(p.email))=c.email)) as is_account,
  coalesce(so.order_count,0)::bigint as order_count,
  coalesce(so.revenue_cents,0)::bigint as shop_revenue_cents,
  coalesce(sr.revenue_cents,0)::bigint as subscription_revenue_cents,
  ss.subscribed_at,ss.renews_at,so.last_order_at,sr.last_payment_at,cs.last_checkout_at
from public.admin_audience_contacts c
cross join sequence seq
left join public.marketing_email_contacts me on me.email=c.email
left join welcome_jobs w on w.email=c.email
left join event_totals e on e.email=c.email
left join subscription_state ss on ss.email=c.email
left join subscription_revenue sr on sr.email=c.email
left join shop_orders so on so.email=c.email
left join checkout_state cs on cs.email=c.email;
revoke all on public.admin_email_funnel_contacts from public,anon,authenticated;
grant select on public.admin_email_funnel_contacts to service_role;

commit;
