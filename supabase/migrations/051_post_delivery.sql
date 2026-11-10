-- No historical backfill and no sends: flags and an explicit enrollment date are
-- required by the worker. Apply in Test first; rollback lives in docs/post-delivery.md.
alter table public.commerce_orders
  add column carrier_delivered_at timestamptz,
  add column customer_received_at timestamptz,
  add column delivery_source text,
  add column delivery_evidence_ref text,
  add column delivery_expected_packages integer check(delivery_expected_packages between 1 and 50),
  add column delivery_issue_at timestamptz,
  add column delivery_returned_at timestamptz,
  add column delivery_disputed_at timestamptz,
  add column delivery_paused_at timestamptz,
  add column post_delivery_stage text not null default 'not_started',
  add column next_email_at timestamptz,
  add column last_email_at timestamptz;

create table public.commerce_delivery_events(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id),
  kind text not null check(kind in('carrier_delivered','customer_received','issue_opened','issue_resolved','returned')),
  package_index integer not null check(package_index between 1 and 50),
  package_count integer not null check(package_count between 1 and 50 and package_index<=package_count),
  source text not null check(source in('admin_evidence','customer_account','customer_link')),
  evidence_ref text,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  event_key uuid not null unique
);
create unique index one_delivery_event_per_package on public.commerce_delivery_events(order_id,kind,package_index)
  where kind in('carrier_delivered','customer_received','returned');
create index commerce_delivery_event_order_date on public.commerce_delivery_events(order_id,occurred_at);

create table public.post_delivery_jobs(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id),
  kind text not null check(kind in('delivery_check','post_delivery_loyalty')),
  version integer not null default 1 check(version=1),
  status text not null default 'pending' check(status in('pending','processing','sent','cancelled','review')),
  due_at timestamptz not null,
  recipient text not null,
  order_number text not null,
  token_expires_at timestamptz not null default(date_trunc('milliseconds',now()+interval '14 days')),
  token_used_at timestamptz,
  claim_id uuid,
  claimed_at timestamptz,
  first_attempt_at timestamptz,
  attempts integer not null default 0,
  provider_id text,
  provider_status text,
  sent_at timestamptz,
  template_digest text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(order_id,kind,version)
);
create index post_delivery_jobs_due on public.post_delivery_jobs(due_at) where status in('pending','processing');
do $$ declare t text; begin
  foreach t in array array['commerce_delivery_events','post_delivery_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on public.%I to service_role',t);
  end loop;
end $$;

create function public.post_delivery_marketing_eligible(p_email text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.marketing_email_contacts c where c.email=lower(trim(p_email)))
    and not exists(select 1 from public.marketing_suppressed_contacts s where s.email=lower(trim(p_email)));
$$;

create function public.record_commerce_delivery(p_order uuid,p_kind text,p_package_index integer,p_package_count integer,
  p_occurred timestamptz,p_evidence text,p_actor uuid,p_source text,p_event uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders; duplicate public.commerce_delivery_events; stamp timestamptz; complete boolean; last_issue timestamptz; last_resolution timestamptz;
begin
  select * into o from public.commerce_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if p_event is null or p_kind is null or p_source is null or p_kind not in('carrier_delivered','customer_received','issue_opened','issue_resolved','returned')
    or p_source not in('admin_evidence','customer_account','customer_link') or p_occurred is null
    or p_package_count is null or p_package_index is null or p_package_count not between 1 and 50 or p_package_index not between 1 and p_package_count
    or p_occurred>now()+interval '1 minute' or p_occurred<o.paid_at then raise exception 'INVALID_INPUT';end if;
  select * into duplicate from public.commerce_delivery_events where event_key=p_event;
  if found then
    if duplicate.order_id<>p_order or duplicate.kind<>p_kind or duplicate.package_index<>p_package_index
      or duplicate.package_count<>p_package_count or duplicate.source<>p_source then raise exception 'IDEMPOTENCY_CONFLICT';end if;
    return jsonb_build_object('duplicate',true);
  end if;
  if p_source='admin_evidence' then
    if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'FORBIDDEN';end if;
    if p_kind in('carrier_delivered','returned','issue_resolved') and coalesce(length(trim(p_evidence)),0)<5 then raise exception 'DELIVERY_EVIDENCE_REQUIRED';end if;
  elsif p_kind not in('customer_received','issue_opened') then raise exception 'FORBIDDEN';end if;
  if coalesce(length(p_evidence),0)>250 then raise exception 'INVALID_INPUT';end if;
  if o.status in('CANCELLED','REFUNDED') and p_kind not in('issue_opened','returned') then raise exception 'INVALID_STATE';end if;
  if o.delivery_expected_packages is not null and o.delivery_expected_packages<>p_package_count then raise exception 'DELIVERY_PACKAGE_COUNT_MISMATCH';end if;
  if p_kind in('carrier_delivered','customer_received','returned') and exists(select 1 from public.commerce_delivery_events
    where order_id=p_order and kind=p_kind and package_index=p_package_index) then return jsonb_build_object('duplicate',true);end if;
  insert into public.commerce_delivery_events(order_id,kind,package_index,package_count,source,evidence_ref,actor_id,occurred_at,event_key)
    values(p_order,p_kind,p_package_index,p_package_count,p_source,nullif(trim(p_evidence),''),p_actor,p_occurred,p_event);
  update public.commerce_orders set delivery_expected_packages=p_package_count where id=p_order;
  if p_kind in('carrier_delivered','customer_received') then
    select count(distinct package_index)=p_package_count,max(occurred_at) into complete,stamp
      from public.commerce_delivery_events where order_id=p_order and kind=p_kind;
    if complete and p_kind='carrier_delivered' then
      update public.commerce_orders set carrier_delivered_at=stamp,delivery_source=p_source,delivery_evidence_ref=nullif(trim(p_evidence),''),
        status=case when status not in('CANCELLED','REFUNDED') then 'DELIVERED' else status end where id=p_order;
    elsif complete and p_kind='customer_received' then
      update public.commerce_orders set customer_received_at=stamp,post_delivery_stage='received',next_email_at=null where id=p_order;
      update public.post_delivery_jobs set status='cancelled',claim_id=null,last_error='CUSTOMER_RECEIVED'
        where order_id=p_order and kind='delivery_check' and status in('pending','processing');
    end if;
  elsif p_kind in('issue_opened','issue_resolved') then
    -- Recompute from event time: late events cannot clear a newer complaint or
    -- reopen an issue already resolved later in the actual chronology.
    select max(occurred_at) filter(where kind='issue_opened'),max(occurred_at) filter(where kind='issue_resolved')
      into last_issue,last_resolution from public.commerce_delivery_events where order_id=p_order;
    update public.commerce_orders set delivery_issue_at=case when last_issue>=coalesce(last_resolution,'-infinity'::timestamptz) then last_issue end,
      post_delivery_stage=case when last_issue>=coalesce(last_resolution,'-infinity'::timestamptz) then 'support' else 'support_resolved' end,
      next_email_at=null where id=p_order;
  elsif p_kind='returned' then
    update public.commerce_orders set delivery_returned_at=p_occurred,post_delivery_stage='returned',next_email_at=null where id=p_order;
  end if;
  if p_kind='returned' or(p_kind='issue_opened' and exists(select 1 from public.commerce_orders where id=p_order and delivery_issue_at is not null)) then
    update public.post_delivery_jobs set status='cancelled',claim_id=null,last_error='SUPPORT_OR_RETURN'
      where order_id=p_order and status in('pending','processing');
  end if;
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,p_order,'delivery:'||p_kind||':package:'||p_package_index::text);
  return jsonb_build_object('duplicate',false,'complete',coalesce(complete,false));
end $$;

-- The old manual "DELIVERED" transition is replaced by evidence-based events.
create or replace function public.update_commerce_fulfillment(p_id uuid,p_status text,p_carrier text,p_tracking text,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders;
begin
  select * into o from public.commerce_orders where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if not((o.status='READY_FOR_FULFILLMENT' and p_status='PREPARING') or(o.status='PREPARING' and p_status='READY_TO_SHIP')
    or(o.status='READY_TO_SHIP' and p_status='SHIPPED')) then raise exception 'INVALID_STATE';end if;
  if p_status='SHIPPED' and(coalesce(length(trim(p_carrier)),0)<2 or coalesce(length(trim(p_tracking)),0)<2) then raise exception 'TRACKING_REQUIRED';end if;
  update public.commerce_orders set status=p_status,carrier=coalesce(nullif(p_carrier,''),carrier),tracking_number=coalesce(nullif(p_tracking,''),tracking_number),
    shipped_at=case when p_status='SHIPPED' then now() else shipped_at end where id=p_id;
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,p_id,p_status);
end $$;

create function public.queue_post_delivery_jobs(p_starts_at timestamptz,p_check_hours integer,p_loyalty_hours integer,p_loyalty boolean)
returns integer language plpgsql security definer set search_path='' as $$
declare added integer; added_loyalty integer;
begin
  if p_starts_at is null or p_starts_at>now() or p_check_hours not between 24 and 336 or p_loyalty_hours not between 24 and 336 then raise exception 'INVALID_INPUT';end if;
  -- Preserve a full response window after the scheduled send, including when
  -- the configured delay itself is fourteen days. Conflict handling below
  -- leaves the capability expiry unchanged on subsequent scheduler runs.
  insert into public.post_delivery_jobs(order_id,kind,due_at,recipient,order_number,token_expires_at)
  select o.id,'delivery_check',o.carrier_delivered_at+make_interval(hours=>p_check_hours),lower(trim(o.customer_email)),o.number,
    date_trunc('milliseconds',o.carrier_delivered_at+make_interval(hours=>p_check_hours)+interval '14 days')
    from public.commerce_orders o where o.carrier_delivered_at>=p_starts_at and o.customer_received_at is null
      and o.status not in('CANCELLED','REFUNDED') and o.delivery_issue_at is null and o.delivery_returned_at is null and o.delivery_disputed_at is null and o.delivery_paused_at is null and o.refunded_amount=0
      and exists(select 1 from public.commerce_delivery_events e where e.order_id=o.id and e.kind='carrier_delivered' and e.created_at>=p_starts_at)
    on conflict(order_id,kind,version) do nothing;
  get diagnostics added=row_count;
  if p_loyalty then
    insert into public.post_delivery_jobs(order_id,kind,due_at,recipient,order_number)
    select o.id,'post_delivery_loyalty',o.customer_received_at+make_interval(hours=>p_loyalty_hours),lower(trim(o.customer_email)),o.number
      from public.commerce_orders o where o.customer_received_at>=p_starts_at and o.status not in('CANCELLED','REFUNDED')
        and o.delivery_issue_at is null and o.delivery_returned_at is null and o.delivery_disputed_at is null and o.delivery_paused_at is null and o.refunded_amount=0
        and public.post_delivery_marketing_eligible(o.customer_email)
        and exists(select 1 from public.commerce_delivery_events e where e.order_id=o.id and e.kind='customer_received' and e.created_at>=p_starts_at)
      on conflict(order_id,kind,version) do nothing;
    get diagnostics added_loyalty=row_count;
  end if;
  update public.commerce_orders o set next_email_at=j.due_at,post_delivery_stage=j.kind||'_scheduled'
    from(select distinct on(order_id) order_id,kind,due_at from public.post_delivery_jobs where status='pending' order by order_id,due_at)j where o.id=j.order_id;
  return added+coalesce(added_loyalty,0);
end $$;

create function public.claim_post_delivery_job(p_loyalty boolean) returns setof public.post_delivery_jobs
language plpgsql security definer set search_path='' as $$
declare j public.post_delivery_jobs; o public.commerce_orders;
begin
  select * into j from public.post_delivery_jobs where due_at<=now() and(kind='delivery_check' or p_loyalty)
    and(status='pending' or(status='processing' and claimed_at<now()-interval '5 minutes')) order by due_at,id limit 1;
  if not found then return;end if;
  -- Lock orders before jobs, as receipt/support transactions do, to avoid the
  -- inverse lock order deadlock with a simultaneous customer confirmation.
  select * into o from public.commerce_orders where id=j.order_id for update skip locked;
  if not found then return;end if;
  select * into j from public.post_delivery_jobs where id=j.id and(status='pending' or(status='processing' and claimed_at<now()-interval '5 minutes'))
    for update skip locked;
  if not found then return;end if;
  if j.first_attempt_at<now()-interval '23 hours' then
    update public.post_delivery_jobs set status='review',claim_id=null,last_error='PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED' where id=j.id;return;
  end if;
  if o.status in('CANCELLED','REFUNDED') or o.refunded_amount>0 or o.delivery_issue_at is not null or o.delivery_returned_at is not null or o.delivery_disputed_at is not null
    or o.delivery_paused_at is not null or lower(trim(o.customer_email))<>j.recipient
    or(j.kind='delivery_check' and(o.carrier_delivered_at is null or o.customer_received_at is not null or j.token_expires_at<=now()))
    or(j.kind='post_delivery_loyalty' and(o.customer_received_at is null or not public.post_delivery_marketing_eligible(j.recipient))) then
    update public.post_delivery_jobs set status='cancelled',claim_id=null,last_error='NO_LONGER_ELIGIBLE' where id=j.id;return;
  end if;
  return query update public.post_delivery_jobs set status='processing',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=j.id returning *;
end $$;

create function public.confirm_commerce_receipt(p_order uuid,p_job uuid,p_expires timestamptz,p_user uuid,p_kind text,p_index integer,p_count integer,p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders;j public.post_delivery_jobs; result jsonb;
begin
  select * into o from public.commerce_orders where id=p_order for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if p_kind not in('customer_received','issue_opened') then raise exception 'FORBIDDEN';end if;
  if p_job is not null then
    select * into j from public.post_delivery_jobs where id=p_job and order_id=p_order for update;
    if not found or j.kind<>'delivery_check' or j.token_expires_at<=now() or date_trunc('milliseconds',j.token_expires_at)<>p_expires
      or j.token_used_at is not null or j.status<>'sent' then raise exception 'NOT_FOUND';end if;
  elsif not exists(select 1 from auth.users u join public.reservations r on r.user_id=u.id
    where r.id=o.reservation_id and u.id=p_user and u.email_confirmed_at is not null
      and lower(trim(u.email))=lower(trim(o.customer_email)) and u.deleted_at is null) then raise exception 'NOT_FOUND';end if;
  result:=public.record_commerce_delivery(p_order,p_kind,p_index,p_count,now(),'',p_user,
    case when p_job is null then 'customer_account' else 'customer_link' end,p_event);
  -- A partial receipt leaves the capability available for the remaining package
  -- indices. Each index can be attested once; the link expires and is consumed
  -- when the full order is received, or immediately when reporting a problem.
  if p_job is not null and(p_kind='issue_opened' or coalesce((result->>'complete')::boolean,false)) then
    update public.post_delivery_jobs set token_used_at=now() where id=p_job;
  end if;
  return result;
end $$;

create function public.pause_post_delivery(p_order uuid,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.commerce_orders set delivery_paused_at=now(),next_email_at=null,post_delivery_stage='paused' where id=p_order;
  if not found then raise exception 'NOT_FOUND';end if;
  update public.post_delivery_jobs set status='cancelled',claim_id=null,last_error='ADMIN_PAUSED' where order_id=p_order and status in('pending','processing');
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,p_order,'post_delivery:paused');
end $$;

create function public.record_commerce_dispute(p_intent text,p_dispute text,p_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare o public.commerce_orders;
begin
  if p_intent is null or p_dispute is null or p_dispute !~ '^du_[a-zA-Z0-9_]+$' or length(p_dispute)>100 or p_at is null or p_at>now()+interval '1 minute' then raise exception 'INVALID_INPUT';end if;
  select * into o from public.commerce_orders where stripe_payment_intent_id=p_intent for update;
  if not found then return;end if;
  if o.delivery_disputed_at is null then
    update public.commerce_orders set delivery_disputed_at=p_at,post_delivery_stage='disputed',next_email_at=null where id=o.id;
    insert into public.commerce_audit(entity_id,action) values(o.id,'post_delivery:stripe_dispute:'||p_dispute);
  end if;
  -- A won/closed dispute does not silently restart commercial sequences.
end $$;

create function private.cancel_post_delivery_after_order_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in('CANCELLED','REFUNDED') or new.refunded_amount>0 or new.delivery_issue_at is not null or new.delivery_returned_at is not null or new.delivery_disputed_at is not null then
    update public.post_delivery_jobs set status='cancelled',claim_id=null,last_error='ORDER_SUPPORT_OR_REFUND' where order_id=new.id and status in('pending','processing');
    new.next_email_at:=null;
    new.post_delivery_stage:=case
      when new.status='CANCELLED' then 'cancelled'
      when new.status='REFUNDED' or new.refunded_amount>0 then 'refunded'
      when new.delivery_disputed_at is not null then 'disputed'
      when new.delivery_returned_at is not null then 'returned'
      else 'support' end;
  end if;return new;
end $$;
-- Update the operational summary in the same row change that stops the jobs;
-- an AFTER trigger cannot replace NEW and would leave a scheduled date visible.
create trigger post_delivery_order_stop before update of status,refunded_amount,delivery_issue_at,delivery_returned_at,delivery_disputed_at on public.commerce_orders
for each row execute function private.cancel_post_delivery_after_order_change();

revoke all on function public.post_delivery_marketing_eligible(text),public.record_commerce_delivery(uuid,text,integer,integer,timestamptz,text,uuid,text,uuid),
  public.queue_post_delivery_jobs(timestamptz,integer,integer,boolean),public.claim_post_delivery_job(boolean),
  public.confirm_commerce_receipt(uuid,uuid,timestamptz,uuid,text,integer,integer,uuid),public.pause_post_delivery(uuid,uuid),public.record_commerce_dispute(text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.post_delivery_marketing_eligible(text),public.record_commerce_delivery(uuid,text,integer,integer,timestamptz,text,uuid,text,uuid),
  public.queue_post_delivery_jobs(timestamptz,integer,integer,boolean),public.claim_post_delivery_job(boolean),
  public.confirm_commerce_receipt(uuid,uuid,timestamptz,uuid,text,integer,integer,uuid),public.pause_post_delivery(uuid,uuid),public.record_commerce_dispute(text,text,timestamptz) to service_role;
