-- Keep existing paid orders and historical personal data; new reservations are minimal.
alter table public.reservations alter column customer_phone drop not null;
alter table public.reservations alter column shipping_address drop not null;
alter table public.commerce_orders alter column customer_phone drop not null;
alter table public.reservations drop constraint reservations_status_check;
alter table public.reservations add constraint reservations_status_check check
  (status in ('WAITLIST','RESERVED','PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED','PAID','CONVERTED_TO_ORDER','CANCELLED','EXPIRED'));
alter table public.reservations add column marketing_consent boolean not null default false;
alter table public.reservations add column marketing_accepted_at timestamptz;
alter table public.reservations add column marketing_version text;
alter table public.reservations add column invited_at timestamptz;
alter table public.reservations add constraint marketing_evidence check
  (not marketing_consent or (marketing_accepted_at is not null and marketing_version is not null));
alter table public.product_variants add column promotional_stock integer not null default 0 check (promotional_stock >= 0);

create table public.commerce_campaign (
  id text primary key check (id='shirt-first-edition'),
  edition_total integer check (edition_total > 0),
  max_reservation_quantity integer not null default 2 check (max_reservation_quantity between 1 and 50),
  reservations_open_at timestamptz,
  purchase_open_at timestamptz,
  purchase_window_hours integer not null default 24 check (purchase_window_hours between 1 and 8760),
  purchase_activated boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.commerce_campaign(id) values('shirt-first-edition');
alter table public.commerce_campaign enable row level security;
revoke all on public.commerce_campaign from public, anon, authenticated;
grant all on public.commerce_campaign to service_role;
alter table public.commerce_outbox drop constraint commerce_outbox_kind_check;
alter table public.commerce_outbox add constraint commerce_outbox_kind_check check
  (kind in ('WAITLIST','RESERVED','CANCELLED','EXPIRED','PURCHASE_AVAILABLE','ORDER_PAID','RESHIP_EMAIL'));
create index reservations_waitlist_fifo on public.reservations(created_at,id) where status='WAITLIST';

drop function public.create_shirt_reservation(uuid,text,text,uuid,jsonb,jsonb,jsonb,text,text,integer);
create function public.create_shirt_reservation(p_request_id uuid,p_payload_hash text,p_token_hash text,p_user_id uuid,
  p_customer jsonb,p_address jsonb,p_items jsonb,p_terms text,p_privacy text,p_expires_hours integer default 0,
  p_marketing boolean default false,p_waitlist boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservations; c public.commerce_campaign; i record; v record;
  rid uuid:=gen_random_uuid(); qty integer:=0; total integer:=0; price integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into r from public.reservations where request_id=p_request_id;
  if found then
    if r.payload_hash<>p_payload_hash or r.token_hash<>p_token_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return r.id;
  end if;
  select * into c from public.commerce_campaign where id='shirt-first-edition' for share;
  if c.reservations_open_at>now() then raise exception 'CAMPAIGN_NOT_OPEN'; end if;
  if c.purchase_activated and not p_waitlist then raise exception 'CAMPAIGN_CLOSED'; end if;
  if coalesce(length(trim(p_customer->>'name')),0) not between 2 and 150
    or coalesce(p_customer->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(p_customer->>'email')>254 then raise exception 'INVALID_CUSTOMER'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 5 then raise exception 'INVALID_ITEMS'; end if;
  if (select count(distinct e->>'sku') from jsonb_array_elements(p_items) e)<>jsonb_array_length(p_items) then raise exception 'DUPLICATE_SKU'; end if;
  if p_expires_hours is null or p_expires_hours<0 or p_expires_hours>8760
    or coalesce(length(p_terms),0)<1 or coalesce(length(p_privacy),0)<1 then raise exception 'INVALID_TERMS'; end if;
  for i in select * from jsonb_to_recordset(p_items) as x(sku text,quantity integer) order by sku loop
    if i.quantity is null or i.quantity<1 then raise exception 'INVALID_QUANTITY'; end if;
    qty:=qty+i.quantity;
    if qty>c.max_reservation_quantity then raise exception 'MAX_RESERVATION_QUANTITY'; end if;
    select pv.*,p.name as product_name into v from public.product_variants pv join public.products p on p.id=pv.product_id
      where pv.sku=i.sku and pv.active and p.slug='camiseta-imperial' for update of pv;
    if not found then raise exception 'INVALID_SKU'; end if;
    if p_waitlist then
      if jsonb_array_length(p_items)<>1 or i.quantity<>1 then raise exception 'INVALID_ITEMS'; end if;
      if v.available_stock>0 then raise exception 'STOCK_AVAILABLE'; end if;
      if exists(select 1 from public.reservations w join public.reservation_items wi on wi.reservation_id=w.id
        where w.status='WAITLIST' and w.customer_email=lower(trim(p_customer->>'email')) and wi.sku=i.sku)
        then raise exception 'ALREADY_WAITLISTED'; end if;
    elsif v.available_stock<i.quantity then raise exception 'OUT_OF_STOCK'; end if;
    select amount into price from public.product_prices where product_id=v.product_id and currency='eur'
      and starts_at<=now() and (ends_at is null or ends_at>now()) order by starts_at desc limit 1;
    if price is distinct from 2999 then raise exception 'PRICE_CONFIGURATION_REQUIRED'; end if;
    total:=total+i.quantity*price;
  end loop;
  insert into public.reservations(id,request_id,payload_hash,token_hash,user_id,status,customer_name,customer_email,
    total_quantity,total_price_snapshot,terms_version,privacy_version,expires_at,marketing_consent,marketing_accepted_at,marketing_version)
  values(rid,p_request_id,p_payload_hash,p_token_hash,p_user_id,case when p_waitlist then 'WAITLIST' else 'RESERVED' end,
    trim(p_customer->>'name'),lower(trim(p_customer->>'email')),qty,total,p_terms,p_privacy,
    case when not p_waitlist and p_expires_hours>0 then now()+make_interval(hours=>p_expires_hours) end,
    coalesce(p_marketing,false),case when p_marketing then now() end,case when p_marketing then p_privacy end);
  for i in select * from jsonb_to_recordset(p_items) as x(sku text,quantity integer) order by sku loop
    select pv.*,p.name as product_name into v from public.product_variants pv join public.products p on p.id=pv.product_id where pv.sku=i.sku;
    if not p_waitlist then update public.product_variants set reserved_stock=reserved_stock+i.quantity where id=v.id; end if;
    insert into public.reservation_items(reservation_id,product_id,variant_id,sku,product_name,size,color,quantity,unit_price_snapshot)
      values(rid,v.product_id,v.id,v.sku,v.product_name,v.name,v.color,i.quantity,2999);
  end loop;
  insert into public.commerce_outbox(reservation_id,kind) values(rid,case when p_waitlist then 'WAITLIST' else 'RESERVED' end);
  return rid;
end $$;
revoke all on function public.create_shirt_reservation(uuid,text,text,uuid,jsonb,jsonb,jsonb,text,text,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.create_shirt_reservation(uuid,text,text,uuid,jsonb,jsonb,jsonb,text,text,integer,boolean,boolean) to service_role;

-- Preserve the original transactional cancellation for stock-holding reservations.
alter function public.release_shirt_reservation(uuid,text) rename to release_shirt_stock_reservation;
create function public.release_shirt_reservation(p_id uuid,p_status text default 'CANCELLED') returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id=p_id for update;
  if r.status='WAITLIST' then
    if p_status<>'CANCELLED' then raise exception 'INVALID_STATE'; end if;
    update public.reservations set status='CANCELLED',cancelled_at=now() where id=p_id;
    insert into public.commerce_outbox(reservation_id,kind) values(p_id,'CANCELLED') on conflict do nothing;
    return true;
  end if;
  return public.release_shirt_stock_reservation(p_id,p_status);
end $$;
revoke all on function public.release_shirt_reservation(uuid,text) from public,anon,authenticated;
grant execute on function public.release_shirt_reservation(uuid,text) to service_role;

create or replace function public.open_shirt_purchase(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.commerce_campaign;
begin
  select * into c from public.commerce_campaign where id='shirt-first-edition' for share;
  if not c.purchase_activated or c.purchase_open_at>now() then raise exception 'CAMPAIGN_NOT_OPEN'; end if;
  update public.reservations set status='PURCHASE_AVAILABLE',invited_at=now(),
    expires_at=now()+make_interval(hours=>c.purchase_window_hours)
    where id=p_id and status='RESERVED' and (expires_at is null or expires_at>now());
  if not found then return false; end if;
  insert into public.commerce_outbox(reservation_id,kind) values(p_id,'PURCHASE_AVAILABLE') on conflict do nothing;
  return true;
end $$;

create function public.invite_next_shirt_waitlist(p_sku text,p_actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; vid uuid; c public.commerce_campaign; available integer;
begin
  select * into c from public.commerce_campaign where id='shirt-first-edition' for share;
  -- Serialize invitations per SKU; lock reservation before variant as in cancellation.
  perform pg_advisory_xact_lock(hashtextextended('waitlist:'||p_sku,0));
  select w.id into rid from public.reservations w join public.reservation_items i on i.reservation_id=w.id
    where w.status='WAITLIST' and i.sku=p_sku order by w.created_at,w.id limit 1 for update of w;
  if rid is null then raise exception 'WAITLIST_EMPTY'; end if;
  select id,available_stock into vid,available from public.product_variants where sku=p_sku and active for update;
  if available is null or available<1 then raise exception 'OUT_OF_STOCK'; end if;
  update public.product_variants set reserved_stock=reserved_stock+1 where id=vid;
  update public.reservations set status=case when c.purchase_activated and (c.purchase_open_at is null or c.purchase_open_at<=now())
    then 'PURCHASE_AVAILABLE' else 'RESERVED' end,invited_at=now(),expires_at=now()+make_interval(hours=>c.purchase_window_hours) where id=rid;
  insert into public.commerce_outbox(reservation_id,kind)
    select rid,case when status='PURCHASE_AVAILABLE' then 'PURCHASE_AVAILABLE' else 'RESERVED' end from public.reservations where id=rid;
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,rid,'WAITLIST_INVITED');
  return rid;
end $$;
revoke all on function public.invite_next_shirt_waitlist(text,uuid) from public,anon,authenticated;
grant execute on function public.invite_next_shirt_waitlist(text,uuid) to service_role;

create function public.configure_shirt_campaign(p_config jsonb,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.commerce_campaign; edition integer;
begin
  select * into c from public.commerce_campaign where id='shirt-first-edition' for update;
  if c.purchase_activated then raise exception 'CAMPAIGN_ALREADY_ACTIVE'; end if;
  edition:=nullif(p_config->>'edition_total','')::integer;
  if edition is not null and edition<(select coalesce(sum(physical_stock+promotional_stock),0) from public.product_variants
    where product_id in(select id from public.products where slug='camiseta-imperial')) then raise exception 'INVALID_EDITION_TOTAL'; end if;
  update public.commerce_campaign set edition_total=edition,
    max_reservation_quantity=(p_config->>'max_reservation_quantity')::integer,
    purchase_window_hours=(p_config->>'purchase_window_hours')::integer,
    reservations_open_at=nullif(p_config->>'reservations_open_at','')::timestamptz,
    purchase_open_at=nullif(p_config->>'purchase_open_at','')::timestamptz,updated_at=now() where id=c.id;
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,gen_random_uuid(),'CAMPAIGN_CONFIGURED');
end $$;
create function public.activate_shirt_campaign(p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.commerce_campaign set purchase_activated=true,updated_at=now() where id='shirt-first-edition' and not purchase_activated;
  if found then insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,gen_random_uuid(),'CAMPAIGN_ACTIVATED'); end if;
end $$;
revoke all on function public.configure_shirt_campaign(jsonb,uuid),public.activate_shirt_campaign(uuid) from public,anon,authenticated;
grant execute on function public.configure_shirt_campaign(jsonb,uuid),public.activate_shirt_campaign(uuid) to service_role;
