-- Preserve the existing atomic stock and idempotency behavior while storing the validated delivery address.
create or replace function public.create_shirt_reservation(p_request_id uuid,p_payload_hash text,p_token_hash text,p_user_id uuid,
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
    shipping_address,total_quantity,total_price_snapshot,terms_version,privacy_version,expires_at,marketing_consent,marketing_accepted_at,marketing_version)
  values(rid,p_request_id,p_payload_hash,p_token_hash,p_user_id,case when p_waitlist then 'WAITLIST' else 'RESERVED' end,
    trim(p_customer->>'name'),lower(trim(p_customer->>'email')),case when p_waitlist then null else p_address end,qty,total,p_terms,p_privacy,
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
