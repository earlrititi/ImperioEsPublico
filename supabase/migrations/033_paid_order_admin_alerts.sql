-- Separate from customer confirmations: backfill must never email buyers twice.
create table public.paid_order_admin_outbox (
  order_id uuid primary key references public.commerce_orders(id),
  status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SENT','REVIEW')),
  attempts integer not null default 0,
  claim_id uuid, claimed_at timestamptz, first_attempt_at timestamptz,
  encrypted_message text, provider_id text, delivery_status text, provider_checked_at timestamptz,
  created_at timestamptz not null default now(), sent_at timestamptz
);
alter table public.paid_order_admin_outbox enable row level security;
revoke all on public.paid_order_admin_outbox from public,anon,authenticated;
grant select,insert,update on public.paid_order_admin_outbox to service_role;

alter table public.admin_notification_history drop constraint admin_notification_history_kind_check;
alter table public.admin_notification_history add constraint admin_notification_history_kind_check
  check(kind in ('registration','checkout_interest','manifesto','paid_subscription','paid_order'));

create function public.queue_paid_order_admin_notice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.paid_order_admin_outbox(order_id) values(new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function public.queue_paid_order_admin_notice() from public,anon,authenticated;
create trigger commerce_order_admin_notice after insert on public.commerce_orders
  for each row execute function public.queue_paid_order_admin_notice();

create function public.claim_paid_order_admin_notice(p_order uuid default null) returns setof public.paid_order_admin_outbox
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  update public.paid_order_admin_outbox set status='REVIEW'
    where status in ('PENDING','PROCESSING') and first_attempt_at<now()-interval '23 hours' and (p_order is null or order_id=p_order);
  select order_id into target from public.paid_order_admin_outbox
    where (p_order is null or order_id=p_order) and (status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
    order by created_at for update skip locked limit 1;
  if target is null then return;end if;
  return query update public.paid_order_admin_outbox set status='PROCESSING',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where order_id=target returning *;
end $$;

create function public.finish_paid_order_admin_notice(p_order uuid,p_claim uuid,p_provider text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_provider is null or length(p_provider)=0 then raise exception 'INVALID_INPUT';end if;
  update public.paid_order_admin_outbox set status='SENT',sent_at=now(),provider_id=p_provider,
    delivery_status='accepted_by_provider',encrypted_message=null where order_id=p_order and claim_id=p_claim and status='PROCESSING';
  get diagnostics changed=row_count;
  if changed<>1 then return false;end if;
  insert into public.admin_notification_history(id,kind,customer_email,subject,occurred_at,source,delivery_status)
    select 'paid_order_admin_'||id,'paid_order',lower(customer_email),'Pedido pagado de camisetas: '||number,
      paid_at,'application','accepted_by_provider' from public.commerce_orders where id=p_order
    on conflict(id) do nothing;
  return true;
end $$;
revoke all on function public.claim_paid_order_admin_notice(uuid) from public,anon,authenticated;
revoke all on function public.finish_paid_order_admin_notice(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_paid_order_admin_notice(uuid),public.finish_paid_order_admin_notice(uuid,uuid,text) to service_role;

insert into public.paid_order_admin_outbox(order_id)
  select id from public.commerce_orders on conflict do nothing;

-- Preserve the existing five-minute scheduler and Vault credential, if installed.
do $migration$ begin
  if to_regprocedure('private.dispatch_commerce_maintenance()') is not null then
    execute $definition$
      create or replace function private.dispatch_commerce_maintenance() returns bigint
      language plpgsql security definer set search_path='' as $body$
      declare request_id bigint; secret text;
      begin
        if not exists(select 1 from public.paid_order_admin_outbox where status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
          and not exists(select 1 from public.paid_order_admin_outbox where status='SENT' and sent_at>now()-interval '7 days'
            and (provider_checked_at is null or (provider_checked_at<now()-interval '1 hour' and delivery_status not in ('delivered','bounced','complained','failed','canceled','suppressed'))))
          and not exists(select 1 from public.commerce_outbox where status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
          and not exists(select 1 from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_FAILED','PAYMENT_PENDING') and expires_at<=now())
          and not exists(select 1 from public.commerce_campaign c where c.purchase_activated and (c.purchase_open_at is null or c.purchase_open_at<=now())
            and exists(select 1 from public.reservations where status='RESERVED')) then return null;end if;
        select decrypted_secret into secret from vault.decrypted_secrets where name='imperio_commerce_job_secret';
        if secret is null then raise exception 'MAINTENANCE_SECRET_MISSING';end if;
        select net.http_post(url:='https://imperioes.com/api/commerce-maintenance',
          headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=30000) into request_id;
        return request_id;
      end $body$;
    $definition$;
  end if;
end $migration$;
