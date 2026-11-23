-- Aggregated private reporting and reversible commercial pauses. No enrollment
-- or template approval is changed. No customer addresses leave these functions.
begin;
create function public.crm_performance_stats() returns jsonb
language sql stable security definer set search_path='' as $$
with jobs as (
 select 'automation'::text as source,j.id,j.key as kind,j.status,j.sent_at,
  j.provider_id,j.provider_delivery_confirmed_at as delivered_at,j.delivery_status
 from public.marketing_automation_jobs j
 union all
 select 'admin',e.id,'editorial',e.status,e.sent_at,e.provider_message_id,e.provider_delivery_confirmed_at,e.delivery_status
 from public.email_logs e where e.type<>'test'
 union all
 select 'post_delivery',j.id,j.kind,j.status,j.sent_at,j.provider_id,null::timestamptz,j.provider_status
 from public.post_delivery_jobs j where j.kind='post_delivery_loyalty'
), receipts as (
 select j.*,coalesce(j.provider_id,m.provider_id) as message_id,
   (j.status='sent' or m.status='sent') and coalesce(j.provider_id,m.provider_id) is not null as accepted,
   coalesce(j.delivered_at,m.provider_delivery_confirmed_at) as confirmed_at,
   coalesce(j.sent_at,m.sent_at) as accepted_at,
   coalesce(j.delivery_status,m.delivery_status) as provider_state
 from jobs j left join public.customer_mail_deliveries m on m.commercial_source=j.source and m.commercial_job_id=j.id
), unique_messages as (
 select distinct on(coalesce(message_id,source||':'||id)) * from receipts
 order by coalesce(message_id,source||':'||id),accepted desc nulls last,confirmed_at nulls last
), states as (
 select r.*,
  exists(select 1 from public.email_provider_events e where e.provider_message_id=r.message_id and e.event_type='delivered') as delivered_event,
  exists(select 1 from public.email_provider_events e where e.provider_message_id=r.message_id and e.event_type='clicked') as clicked_event,
  exists(select 1 from public.email_provider_events e where e.provider_message_id=r.message_id and e.event_type='bounced') as bounced_event,
  exists(select 1 from public.email_provider_events e where e.provider_message_id=r.message_id and e.event_type='complained') as complained_event
 from unique_messages r
), branch_stats as (
 select kind,count(*) filter(where status in('pending','processing')) as pending,
  count(*) filter(where accepted) as accepted,
  count(*) filter(where (confirmed_at is not null or delivered_event) and provider_state is distinct from 'bounced'
    and provider_state is distinct from 'complained' and provider_state is distinct from 'failed') as delivered,
  count(*) filter(where clicked_event) as clicked,
  count(*) filter(where bounced_event or provider_state='bounced') as bounced,
  count(*) filter(where complained_event or provider_state='complained') as complained,
  count(*) filter(where status in('failed','review') or provider_state='failed') as review,
  count(*) filter(where status in('suppressed','cancelled')) as suppressed
 from states group by kind
), paid_orders as (
 select total,refunded_amount,lower(trim(customer_email)) as identity from public.commerce_orders
 where stripe_checkout_session_id like 'cs_live_%' and stripe_payment_intent_id like 'pi_%' and currency='eur' and total>0
), buyers as (select identity,count(*) as purchases,sum(total-refunded_amount) as net from paid_orders group by identity),
 invoices as (
 select distinct on(invoice_id) invoice_id,amount_paid from public.stripe_webhook_events
 where status='completed' and event_type in('invoice.paid','invoice.payment_succeeded')
  and invoice_id is not null and currency='eur' and amount_paid>0
 order by invoice_id,occurred_at desc nulls last,event_id
), health as (
 select count(*) filter(where accepted) as accepted,
  count(*) filter(where confirmed_at is not null or delivered_event) as delivered,
  count(*) filter(where bounced_event or provider_state='bounced') as bounced,
  count(*) filter(where complained_event or provider_state='complained') as complained,
  count(*) filter(where status in('failed','review') or provider_state='failed') as failed
 from states where accepted_at>=now()-interval '24 hours'
)
select jsonb_build_object(
 'generated_at',now(),'period','all_recorded_history',
 'audience',jsonb_build_object(
  'captured',(select count(*) from public.admin_audience_contacts),
  'accounts',(select count(*) from public.profiles),
  'verified_accounts',(select count(*) from auth.users where email_confirmed_at is not null and deleted_at is null),
  'verified_contacts',(select count(*) from public.admin_audience_contacts where verified_at is not null),
  'eligible',(select count(*) from public.marketing_email_contacts),
  'owner_declared',(select count(*) from public.marketing_email_contacts c join public.legal_consents l on l.id=c.consent_id
    where l.source='owner_confirmed_historical_permission'),
  'unsubscribed',(select count(*) from public.email_suppressions where reason='unsubscribe'),
  'blocked',(select count(*) from public.email_suppressions where reason<>'unsubscribe')),
 'branches',(select coalesce(jsonb_agg(to_jsonb(b) order by public.commercial_mail_priority(kind)),'[]'::jsonb) from branch_stats b),
 'commerce',jsonb_build_object(
  'paid_orders',(select count(*) from paid_orders),
  'collected_cents',(select coalesce(sum(total),0) from paid_orders),
  'refund_cents',(select coalesce(sum(refunded_amount),0) from paid_orders),
  'net_collected_cents',(select coalesce(sum(total-refunded_amount),0) from paid_orders),
  'buyers',(select count(*) from buyers),
  'repeat_buyers',(select count(*) from buyers where purchases>1),
  'recorded_invoice_gross_cents',(select coalesce(sum(amount_paid),0) from invoices),
  'attributed_recovery_orders',null,'attributed_net_revenue_cents',null,
  'margin_cents',null,'cost_per_conversion_cents',null,'projected_lifetime_value_cents',null),
 'health_24h',(select to_jsonb(h) from health h),
 'policy',(select jsonb_build_object('paused',commercial_paused,'kinds',commercial_paused_kinds,
  'frequency_enabled',commercial_frequency_enabled,'daily_limit',commercial_daily_limit,'daily_hours',commercial_daily_hours,
  'weekly_limit',commercial_weekly_limit,'weekly_hours',commercial_weekly_hours) from public.marketing_automation_runtime where id=true)
);
$$;

create function public.set_crm_commercial_pause(p_actor uuid,p_expected jsonb,p_paused boolean,p_kinds text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_policy public.marketing_automation_runtime; kinds text[]; changed boolean;
begin
 if p_actor is null or p_paused is null or p_kinds is null or not p_kinds <@
  array['checkout','cart','viewed_product','welcome','editorial','post_delivery_loyalty','site']::text[] then raise exception 'INVALID_INPUT';end if;
 select * into current_policy from public.marketing_automation_runtime where id=true for update;
 if not found then raise exception 'CRM_MIGRATION_REQUIRED';end if;
 if p_expected is distinct from jsonb_build_object('paused',current_policy.commercial_paused,'kinds',current_policy.commercial_paused_kinds)
  then raise exception 'REQUEST_CONFLICT';end if;
 select coalesce(array_agg(v order by v),'{}') into kinds from(select distinct unnest(p_kinds) as v)t;
 changed:=p_paused is distinct from current_policy.commercial_paused or kinds is distinct from current_policy.commercial_paused_kinds;
 update public.marketing_automation_runtime set commercial_paused=p_paused,commercial_paused_kinds=kinds where id=true;
 if changed then insert into public.commerce_audit(actor_id,entity_id,entity,action)
  values(p_actor,gen_random_uuid(),'crm_commercial_policy',case when p_paused then 'COMMERCIAL_PAUSED' else 'COMMERCIAL_PAUSE_POLICY_UPDATED' end);end if;
 return jsonb_build_object('paused',p_paused,'kinds',kinds);
end $$;
revoke all on function public.crm_performance_stats(),public.set_crm_commercial_pause(uuid,jsonb,boolean,text[]) from public,anon,authenticated;
grant execute on function public.crm_performance_stats(),public.set_crm_commercial_pause(uuid,jsonb,boolean,text[]) to service_role;
commit;
