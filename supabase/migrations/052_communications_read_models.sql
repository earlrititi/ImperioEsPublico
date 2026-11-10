-- Read-only projections: the existing queues remain the single source of truth.
-- Not applied automatically. No provider connection or mail dispatch is enabled here.
begin;
-- Older code promoted opens/clicks to delivered. Preserve those records, but do
-- not call them proven delivery until a fresh delivered event is observed.
alter table public.email_logs add column provider_delivery_confirmed_at timestamptz;
alter table public.marketing_automation_jobs add column provider_delivery_confirmed_at timestamptz;
alter table public.paid_order_admin_outbox add column provider_delivery_confirmed_at timestamptz;
alter table public.seo_jobs add column provider_delivery_confirmed_at timestamptz;
create function public.admin_mail_state(p_status text,p_delivery text,p_due timestamptz default null)
returns text language sql stable set search_path='' as $$
select case
 when lower(coalesce(p_delivery,'')) in ('delivered','deferred','bounced','complained','failed','unsubscribed') then lower(p_delivery)
 when lower(coalesce(p_delivery,'')) in ('canceled','cancelled') then 'cancelled'
 when lower(p_status)='received' then 'received'
 when lower(p_status) in ('sent','accepted','succeeded') then 'accepted_by_provider'
 when lower(p_status)='suppressed' then 'unsubscribed'
 when lower(p_status) in ('cancelled','canceled') then 'cancelled'
 when lower(p_status)='failed' then 'failed'
 when lower(p_status) in ('review','needs_review') then 'review'
 when lower(p_status)='processing' then 'processing'
 when lower(p_status)='pending' and p_due>now() then 'scheduled'
 when lower(p_status)='pending' then 'queued' else 'recorded' end
$$;
revoke all on function public.admin_mail_state(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_mail_state(text,text,timestamptz) to service_role;
create function public.admin_verified_mail_state(p_status text,p_delivery text,p_confirmed timestamptz,p_due timestamptz default null)
returns text language sql stable set search_path='' as $$
 select public.admin_mail_state(p_status,case
   when p_delivery in('bounced','complained','failed','unsubscribed') then p_delivery
   when p_confirmed is not null then 'delivered'
   when p_delivery='delivered' then null else p_delivery end,p_due)
$$;
revoke all on function public.admin_verified_mail_state(text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_verified_mail_state(text,text,timestamptz,timestamptz) to service_role;
create or replace function public.marketing_automation_stats() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]'::jsonb) from (
   select key,count(*) filter(where status in('pending','processing')) as pending,
     count(*) filter(where status='sent') as accepted,
     count(*) filter(where provider_delivery_confirmed_at is not null and coalesce(delivery_status,'') not in('bounced','complained','failed')) as delivered,
     count(*) filter(where status='suppressed') as suppressed,
     count(*) filter(where status='review' or delivery_status in('bounced','complained','failed')) as review
   from public.marketing_automation_jobs group by key
 ) row
$$;

-- Only explicitly authorised mailbox imports may write these bounded private records.
create table public.communication_mailboxes (
 id uuid primary key default gen_random_uuid(),label text not null,
 provider text not null check(provider in ('ionos_imap','test_imap')),mailbox text not null,
 enabled boolean not null default false,authorised_at timestamptz,authorised_by uuid references auth.users(id),
 import_since timestamptz not null,retention_days integer not null default 90 check(retention_days between 1 and 365),
 uidvalidity bigint,last_uid bigint not null default 0,last_sync_at timestamptz,
 state text not null default 'not_connected' check(state in ('not_connected','ready','syncing','error','reset_required')),
 unique(provider,mailbox),check(not enabled or (authorised_at is not null and authorised_by is not null))
);
create table public.communication_inbound_messages (
 id uuid primary key default gen_random_uuid(),mailbox_id uuid not null references public.communication_mailboxes(id) on delete cascade,
 uidvalidity bigint not null,uid bigint not null,internet_message_id text,
 in_reply_to text,references_ids text[] not null default '{}',sender text not null,recipients text[] not null,
 subject text not null,safe_html text not null default '',safe_text text not null default '',
 occurred_at timestamptz not null,seen boolean,synced_at timestamptz not null default now(),
 -- Attachments are metadata only; no arbitrary URLs or unreviewed content is stored.
 attachments jsonb not null default '[]',unique(mailbox_id,uidvalidity,uid)
);
create index communication_inbound_message_id_idx on public.communication_inbound_messages(internet_message_id);
create index communication_inbound_date_idx on public.communication_inbound_messages(occurred_at desc,id);
create unique index communication_inbound_dedup_idx on public.communication_inbound_messages(mailbox_id,internet_message_id) where internet_message_id is not null;
do $$ declare t text;begin
 foreach t in array array['communication_mailboxes','communication_inbound_messages'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to service_role',t);
 end loop;
end $$;

create view public.admin_communication_source_records with(security_barrier=true) as
select 'email_logs:'||e.id as id,'email_logs'::text as source,e.id::text as source_id,'outbound'::text as direction,
 e.created_at,coalesce(e.sent_at,e.created_at) as occurred_at,e.sent_at,e.provider_checked_at as last_provider_check,
 coalesce(e.provider_payload->>'from','') as sender,lower(trim(e.recipient)) as email,
 coalesce((select p.full_name from public.profiles p where lower(trim(p.email))=lower(trim(e.recipient)) limit 1),'') as customer_name,
 e.subject,case when e.type='campaign' then 'marketing' else 'soporte' end as type,
 coalesce(e.campaign_id::text,'manual') as flow,e.type as stage,e.status as source_status,
 public.admin_verified_mail_state(e.status,e.delivery_status,e.provider_delivery_confirmed_at) as state,e.delivery_status,
 'resend'::text as provider,e.provider_message_id as provider_id,
 null::text as order_id,e.attempts,e.error,e.provider_payload->>'html' as body_html,
 coalesce(e.provider_payload->>'text',e.content) as body_text,e.provider_payload->'headers'->>'Message-ID' as internet_message_id,
 null::text as in_reply_to,null::boolean as seen
from public.email_logs e
union all
select 'marketing_automation_jobs:'||j.id,'marketing_automation_jobs',j.id::text,'outbound',j.created_at,coalesce(j.sent_at,j.due_at,j.created_at),j.sent_at,j.provider_checked_at,
 coalesce(j.provider_payload->>'from',''),lower(trim(coalesce(to_jsonb(j)->>'contact_email',p.email,''))),coalesce(p.full_name,''),
 coalesce(j.provider_payload->>'subject','Automatización · '||j.key||' · '||j.step),'marketing',j.key,j.step,j.status,
 public.admin_verified_mail_state(j.status,j.delivery_status,j.provider_delivery_confirmed_at,j.due_at),j.delivery_status,'resend',j.provider_id,null,j.attempts,j.reason,
 j.provider_payload->>'html',j.provider_payload->>'text',j.provider_payload->'headers'->>'Message-ID',null,null
from public.marketing_automation_jobs j left join public.profiles p on p.id=j.user_id
union all
select 'marketing_email_verifications:'||v.id,'marketing_email_verifications',v.id::text,'outbound',v.created_at,coalesce(v.confirmation_sent_at,v.created_at),v.confirmation_sent_at,null,
 '',v.email,v.name,'Solicitud de verificación de email','transaccional','marketing_verification','verify',case when v.confirmation_provider_id is not null then 'sent' else 'recorded' end,
 case when v.confirmation_provider_id is not null then 'accepted_by_provider' else 'recorded' end,null,'resend',v.confirmation_provider_id,null,0,null,null,null,null,null,null
from public.marketing_email_verifications v
union all
select 'marketing_subscription_notices:'||n.consent_id,'marketing_subscription_notices',n.consent_id::text,'outbound',n.created_at,coalesce(n.sent_at,n.created_at),n.sent_at,null,
 '',n.email,'','Confirmación de suscripción comercial','transaccional','marketing_subscription','subscription_confirmed',n.status,
 public.admin_mail_state(n.status,null),null,'resend',n.provider_id,null,n.attempts,null,null,null,null,null,null
from public.marketing_subscription_notices n
union all
select 'post_delivery_jobs:'||j.id,'post_delivery_jobs',j.id::text,'outbound',j.created_at,coalesce(j.sent_at,j.due_at,j.created_at),j.sent_at,null,
 '',lower(trim(j.recipient)),o.customer_name,case when j.kind='delivery_check' then 'Comprobación de recepción de camiseta' else 'Posentrega de camiseta' end,
 case when j.kind='delivery_check' then 'transaccional' else 'marketing' end,'post_delivery',j.kind,j.status,
 public.admin_mail_state(j.status,j.provider_status,j.due_at),j.provider_status,'resend',j.provider_id,j.order_id::text,j.attempts,j.last_error,null,null,null,null,null
from public.post_delivery_jobs j join public.commerce_orders o on o.id=j.order_id
union all
select 'commerce_outbox:'||j.id,'commerce_outbox',j.id::text,'outbound',j.created_at,coalesce(j.sent_at,j.created_at),j.sent_at,null,
 '',lower(trim(r.customer_email)),r.customer_name,'Comercio · '||j.kind,'transaccional','commerce',j.kind,j.status,
 public.admin_mail_state(j.status,null),null,'resend',j.provider_id,r.order_id::text,j.attempts,null,null,null,null,null,null
from public.commerce_outbox j join public.reservations r on r.id=j.reservation_id
union all
select 'manifesto_requests:'||m.id,'manifesto_requests',m.id::text,'outbound',m.created_at,coalesce(m.accepted_at,m.created_at),m.accepted_at,null,
 '',lower(trim(m.email)),m.name,case when m.resource='seven_stories' then 'Siete historias' else 'Manifiesto / PDF' end,'transaccional',m.resource,'resource_delivery',m.status,
 public.admin_mail_state(m.status,null),null,'resend',m.provider_id,null,0,null,null,null,null,null,null
from public.manifesto_requests m
union all
select 'marketing_leads:'||l.id,'marketing_leads',l.id::text,'outbound',l.created_at,coalesce(l.email_sent_at,l.created_at),l.email_sent_at,null,
 '',l.email,l.name,'Cupón de camiseta (registro local)','transaccional','tshirt_coupon','coupon',
 'recorded','recorded',null,'resend',null,null,0,null,null,null,null,null,null
from public.marketing_leads l where l.email_sent_at is not null
union all
select 'paid_order_admin_outbox:'||j.order_id,'paid_order_admin_outbox',j.order_id::text,'outbound',j.created_at,coalesce(j.sent_at,j.created_at),j.sent_at,j.provider_checked_at,
 '','','','Aviso administrativo de pedido pagado','transaccional','admin_order','ORDER_PAID',j.status,
 public.admin_verified_mail_state(j.status,j.delivery_status,j.provider_delivery_confirmed_at),j.delivery_status,'resend',j.provider_id,j.order_id::text,j.attempts,null,null,null,null,null,null
from public.paid_order_admin_outbox j
union all
select 'seo_jobs:'||j.id,'seo_jobs',j.id::text,'outbound',j.created_at,coalesce(j.finished_at,j.created_at),j.finished_at,j.provider_checked_at,
 '','','','Aviso editorial','transaccional','seo','notify',j.status,public.admin_verified_mail_state(j.status,j.delivery_status,j.provider_delivery_confirmed_at,j.due_at),
 j.delivery_status,'resend',j.provider_id,null,j.attempts,j.error,null,null,null,null,null
from public.seo_jobs j where j.kind='notify'
union all
select 'mailbox:'||m.id,'mailbox',m.id::text,'inbound',m.synced_at,m.occurred_at,null,m.synced_at,
 m.sender,coalesce(m.recipients[1],''),'',m.subject,'soporte','mailbox','inbound','received','received',null,
 b.provider,m.internet_message_id,null,0,null,m.safe_html,m.safe_text,m.internet_message_id,m.in_reply_to,m.seen
from public.communication_inbound_messages m join public.communication_mailboxes b on b.id=m.mailbox_id;
revoke all on public.admin_communication_source_records from public,anon,authenticated;
grant select on public.admin_communication_source_records to service_role;
-- A repeated webhook/import cannot add a second visible copy of the same
-- authentic provider message. Null IDs remain distinct local records.
create view public.admin_communication_records with(security_barrier=true) as
select distinct on (case when provider_id is not null then direction||':'||provider||':'||provider_id else id end) *,
 case when source in ('marketing_subscription_notices','paid_order_admin_outbox','seo_jobs') then '' else email end as recipient_email,
 (source in ('email_logs','mailbox') or (source='marketing_automation_jobs' and body_html is not null)) as subject_available
from public.admin_communication_source_records
order by (case when provider_id is not null then direction||':'||provider||':'||provider_id else id end),
 case when body_html is not null then 0 else 1 end,created_at,id;
revoke all on public.admin_communication_records from public,anon,authenticated;
grant select on public.admin_communication_records to service_role;

create view public.admin_communication_coverage with(security_barrier=true) as
select source,count(*) as records,min(created_at) as history_from,max(occurred_at) as latest_record,
 max(last_provider_check) as last_provider_check,
 count(*) filter(where provider_id is not null) as provider_identified,
 count(*) filter(where state='delivered') as confirmed_delivered
from public.admin_communication_source_records group by source;
revoke all on public.admin_communication_coverage from public,anon,authenticated;
grant select on public.admin_communication_coverage to service_role;

-- This view includes non-marketing customers; their state stays no_consent.
-- Group only the same normalised address, retaining source IDs. No identity merge.
create view public.admin_audience_sources with(security_barrier=true) as
select lower(trim(p.email)) as email,p.full_name as name,'piquero'::text as source,p.id::text as source_id,p.created_at as created_at
from public.profiles p
union all select lower(trim(r.customer_email)),r.customer_name,'camiseta',r.id::text,r.created_at from public.reservations r
union all select lower(trim(m.email)),m.name,case when m.resource='seven_stories' then 'newsletter' else 'manifiesto' end,m.id::text,m.created_at from public.manifesto_requests m
union all select lower(trim(l.email)),l.name,'popup_camiseta',l.id::text,l.created_at from public.marketing_leads l
union all select lower(trim(s.email)),'','supresion',s.email,s.created_at from public.email_suppressions s
union all select lower(trim(v.email)),to_jsonb(v)->>'name','verificacion',v.id::text,(to_jsonb(v)->>'created_at')::timestamptz from public.marketing_email_verifications v
union all select lower(trim(s.email)),'','suscripcion_pago',s.id::text,s.created_at from public.subscriptions s where s.email is not null
union all select lower(trim(e.recipient)),'','campana',e.id::text,e.created_at from public.email_logs e where e.type='campaign'
union all select lower(trim(coalesce(j.contact_email,p.email))),'','automatizacion',j.id::text,j.created_at from public.marketing_automation_jobs j left join public.profiles p on p.id=j.user_id;
revoke all on public.admin_audience_sources from public,anon,authenticated;
grant select on public.admin_audience_sources to service_role;

create view public.admin_audience_contacts with(security_barrier=true) as
with grouped as (
 select s.email,max(s.name) filter(where s.name<>'') as name,min(s.created_at) as created_at,
 array_agg(distinct s.source) as sources,jsonb_agg(jsonb_build_object('source',s.source,'id',s.source_id,'created_at',s.created_at)) as source_ids
 from public.admin_audience_sources s
 where s.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
 -- Administrative identities never become rows in the visible marketing directory.
 and not exists(select 1 from public.profiles p where lower(trim(p.email))=s.email and p.id in ('24f42701-98e0-4716-810c-363ae1cc8fa2'::uuid,'596ce13f-3a34-467e-a5b3-65251a5cf446'::uuid))
 group by s.email
)
select g.*,e.user_id,e.consent_id,e.marketing_accepted_at,e.source as consent_source,
 coalesce(e.verified_at,(select max(u.email_confirmed_at) from auth.users u where lower(trim(u.email))=g.email and u.deleted_at is null),
 (select max((to_jsonb(v)->>'verified_at')::timestamptz) from public.marketing_email_verifications v where v.email=g.email)) as verified_at,
 exists(select 1 from public.marketing_suppressed_contacts s where s.email=g.email) as suppressed,
 (select s.reason from public.email_suppressions s where s.email=g.email) as suppression_reason,
 (select p.accepted from public.account_email_preferences p where p.email=g.email) as preference,
 case
  when exists(select 1 from public.email_suppressions s where s.email=g.email and s.reason<>'unsubscribe') then 'suppressed'
  when exists(select 1 from public.marketing_suppressed_contacts s where s.email=g.email) then 'unsubscribed'
  when e.email is not null then 'eligible'
  when exists(select 1 from public.reservations r where lower(trim(r.customer_email))=g.email and r.marketing_consent and r.marketing_withdrawn_at is null)
   or exists(select 1 from public.manifesto_requests m where lower(trim(m.email))=g.email and m.marketing_consent)
   or exists(select 1 from public.marketing_leads l where l.email=g.email and l.marketing_accepted_at is not null)
   or exists(select 1 from public.legal_consents c join public.profiles p on p.id=c.user_id where lower(trim(p.email))=g.email and c.consent_type='marketing_email' and c.accepted and c.withdrawn_at is null)
   or exists(select 1 from public.marketing_email_verifications v join public.legal_consents c on c.id=v.consent_id where v.email=g.email and c.accepted and c.withdrawn_at is null)
   then 'pending_verification' else 'no_consent' end as state,
 (select j.step from public.marketing_automation_jobs j left join public.profiles p on p.id=j.user_id where lower(trim(coalesce(to_jsonb(j)->>'contact_email',p.email,'')))=g.email and j.key='welcome' order by j.created_at desc,j.id desc limit 1) as welcome_step,
 (select j.status from public.marketing_automation_jobs j left join public.profiles p on p.id=j.user_id where lower(trim(coalesce(to_jsonb(j)->>'contact_email',p.email,'')))=g.email and j.key='welcome' order by j.created_at desc,j.id desc limit 1) as welcome_status,
 (select min(m.occurred_at) from public.admin_communication_records m where m.email=g.email and m.state in ('scheduled','queued')) as next_mail_at,
 (select max(m.sent_at) from public.admin_communication_records m where m.email=g.email) as last_mail_at,
 (select count(*) from public.commerce_orders o where lower(trim(o.customer_email))=g.email) as order_count,
 (select max(o.shipped_at) from public.commerce_orders o where lower(trim(o.customer_email))=g.email) as shipped_at,
 (select max(coalesce(to_jsonb(o)->>'customer_received_at',to_jsonb(o)->>'receipt_confirmed_at')) from public.commerce_orders o where lower(trim(o.customer_email))=g.email) as customer_received_at
from grouped g left join public.marketing_email_contacts e on e.email=g.email;
revoke all on public.admin_audience_contacts from public,anon,authenticated;
grant select on public.admin_audience_contacts to service_role;

create view public.admin_audience_totals with(security_barrier=true) as
select 'state'::text as dimension,state as segment,count(*) as total from public.admin_audience_contacts group by state
union all select 'source',s,count(*) from public.admin_audience_contacts,unnest(sources) s group by s
union all select 'welcome',coalesce(welcome_step,'sin_secuencia'),count(*) from public.admin_audience_contacts group by welcome_step
union all select 'postdelivery','customer_received',count(*) from public.admin_audience_contacts where customer_received_at is not null;
revoke all on public.admin_audience_totals from public,anon,authenticated;
grant select on public.admin_audience_totals to service_role;

create view public.admin_audience_timeline with(security_barrier=true) as
select lower(trim(p.email)) as email,c.id::text as id,'legal_consents'::text as source,c.created_at as occurred_at,
 'Consentimiento comercial'::text as label,case when c.withdrawn_at is not null then 'withdrawn' when c.accepted then 'accepted' else 'declined' end as status,
 jsonb_build_object('version',c.document_version,'channel',c.source,'withdrawn_at',c.withdrawn_at) as detail
from public.legal_consents c join public.profiles p on p.id=c.user_id where c.consent_type='marketing_email'
union all select p.email,'preference:'||p.user_id,'account_email_preferences',p.updated_at,'Preferencia de email',case when p.accepted then 'accepted' else 'unsubscribed' end,jsonb_build_object('consent_id',p.consent_id) from public.account_email_preferences p
union all select lower(trim(r.customer_email)),r.id::text,'reservations',r.created_at,'Reserva de camiseta',r.status,jsonb_build_object('marketing_consent',r.marketing_consent,'consent_at',r.marketing_accepted_at,'version',r.marketing_version,'withdrawn_at',r.marketing_withdrawn_at) from public.reservations r
union all select lower(trim(m.email)),m.id::text,'manifesto_requests',m.created_at,'Recurso solicitado',m.status,jsonb_build_object('resource',m.resource,'marketing_consent',m.marketing_consent,'channel',m.source) from public.manifesto_requests m
union all select l.email,l.id::text,'marketing_leads',l.created_at,'Alta desde camiseta','recorded',jsonb_build_object('consent_at',l.marketing_accepted_at,'version',l.marketing_version,'channel',l.source) from public.marketing_leads l
union all select s.email,'suppression:'||s.email,'email_suppressions',s.created_at,'Supresión',s.reason,'{}'::jsonb from public.email_suppressions s
union all select v.email,v.id::text,'marketing_email_verifications',v.created_at,'Verificación de email',case when v.verified_at is not null then 'verified' when v.expires_at<now() then 'expired' else 'pending' end,jsonb_build_object('verified_at',v.verified_at,'consent_id',v.consent_id) from public.marketing_email_verifications v
union all select lower(trim(o.customer_email)),o.id::text,'commerce_orders',o.paid_at,'Compra confirmada',o.status,jsonb_build_object('order_id',o.id,'number',o.number,'shipped_at',o.shipped_at,'customer_received_at',coalesce(to_jsonb(o)->>'customer_received_at',to_jsonb(o)->>'receipt_confirmed_at')) from public.commerce_orders o
union all select lower(trim(o.customer_email)),e.id::text,'commerce_delivery_events',e.occurred_at,'Recepción / incidencia de camiseta',e.kind,jsonb_build_object('order_id',e.order_id,'source',e.source,'package_index',e.package_index,'package_count',e.package_count,'evidence_recorded',e.evidence_ref is not null) from public.commerce_delivery_events e join public.commerce_orders o on o.id=e.order_id
union all select m.email,m.id,m.source,m.occurred_at,m.subject,m.state,jsonb_build_object('message_id',m.id,'flow',m.flow,'stage',m.stage) from public.admin_communication_records m where m.direction='outbound'
union all select m.sender,m.id,m.source,m.occurred_at,'Correo entrante: '||m.subject,'received',jsonb_build_object('message_id',m.id,'in_reply_to',m.in_reply_to) from public.admin_communication_records m where m.direction='inbound';
revoke all on public.admin_audience_timeline from public,anon,authenticated;
grant select on public.admin_audience_timeline to service_role;
commit;
