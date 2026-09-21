-- Isolated reservation inventory. Existing product and price history is retained.
alter table public.product_variants rename column stock to physical_stock;
alter table public.product_variants add column reserved_stock integer not null default 0 check (reserved_stock >= 0);
alter table public.product_variants add column sold_stock integer not null default 0 check (sold_stock >= 0);
alter table public.product_variants add column color text not null default 'Diseno Imperial';
alter table public.product_variants add column available_stock integer generated always as (physical_stock - reserved_stock - sold_stock) stored;
alter table public.product_variants add constraint inventory_nonnegative check (physical_stock >= reserved_stock + sold_stock);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('RES-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  request_id uuid not null unique,
  payload_hash text not null,
  token_hash text not null check (length(token_hash) = 64),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'RESERVED' check (status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED','PAID','CONVERTED_TO_ORDER','CANCELLED','EXPIRED')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_address jsonb not null,
  currency text not null default 'eur' check (currency = 'eur'),
  total_quantity integer not null check (total_quantity > 0),
  total_price_snapshot integer not null check (total_price_snapshot > 0),
  terms_accepted_at timestamptz not null default now(),
  terms_version text not null,
  privacy_accepted_at timestamptz not null default now(),
  privacy_version text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  expired_at timestamptz,
  converted_at timestamptz,
  order_id uuid,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique
);
create index reservations_user_idx on public.reservations(user_id, created_at desc);
create index reservations_expiry_idx on public.reservations(expires_at) where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_FAILED');
create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  product_id uuid not null references public.products(id),
  variant_id uuid not null references public.product_variants(id),
  sku text not null,
  product_name text not null,
  size text not null,
  color text not null,
  quantity integer not null check (quantity > 0),
  unit_price_snapshot integer not null check (unit_price_snapshot = 2999),
  line_total_snapshot integer generated always as (quantity * unit_price_snapshot) stored,
  currency text not null default 'eur' check (currency = 'eur'),
  vat_included boolean not null default true check (vat_included),
  shipping_included boolean not null default true check (shipping_included),
  unique(reservation_id, variant_id)
);
create table public.reservation_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  status text not null default 'OPEN' check (status in ('OPEN','PAID','EXPIRED')),
  shipping_address jsonb not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  purchase_confirmed_at timestamptz not null default now(),
  terms_version text not null
);
create unique index one_open_payment_per_reservation on public.reservation_payment_attempts(reservation_id) where status = 'OPEN';
create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('PED-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  reservation_id uuid not null unique references public.reservations(id),
  reservation_number text not null,
  status text not null default 'READY_FOR_FULFILLMENT' check (status in ('PAID','READY_FOR_FULFILLMENT','PREPARING','READY_TO_SHIP','SHIPPED','DELIVERED','CANCELLED','REFUNDED')),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_address jsonb not null,
  total_quantity integer not null,
  subtotal integer not null,
  total integer not null,
  currency text not null check (currency = 'eur'),
  vat_included boolean not null default true check (vat_included),
  vat_amount integer not null default 0,
  shipping_included boolean not null default true check (shipping_included),
  shipping_charged integer not null default 0 check (shipping_charged = 0),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  refunded_amount integer not null default 0 check (refunded_amount >= 0 and refunded_amount <= total),
  carrier text,
  tracking_number text,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz not null default now()
);
alter table public.reservations add constraint reservation_order_fk foreign key(order_id) references public.commerce_orders(id);
create table public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.commerce_orders(id),
  reservation_item_id uuid not null unique references public.reservation_items(id),
  sku text not null, product_name text not null, size text not null, color text not null,
  quantity integer not null, unit_price integer not null,
  line_total integer not null, currency text not null
);
create table public.commerce_outbox (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  kind text not null check(kind in ('RESERVED','CANCELLED','EXPIRED','PURCHASE_AVAILABLE','ORDER_PAID','RESHIP_EMAIL')),
  version uuid not null default '00000000-0000-0000-0000-000000000000',
  status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SENT','REVIEW')),
  attempts integer not null default 0,
  claim_id uuid,
  claimed_at timestamptz,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  created_at timestamptz not null default now(),
  unique(reservation_id, kind, version)
);
create table public.commerce_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['reservations','reservation_items','reservation_payment_attempts','commerce_orders','commerce_order_items','commerce_outbox','commerce_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.commerce_audit_id_seq to service_role;
create trigger reservations_updated before update on public.reservations for each row execute procedure private.set_updated_at();

create function private.valid_mainland_address(a jsonb) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(a) = 'object' and a->>'country' = 'ES'
    and a->>'postalCode' ~ '^[0-9]{5}$'
    and left(a->>'postalCode',2) = a->>'province'
    and a->>'province' ~ '^(0[1-9]|[1-4][0-9]|50)$'
    and a->>'province' not in ('07','35','38')
    and right(a->>'postalCode',3) <> '000'
    and length(trim(a->>'name')) between 2 and 150
    and length(trim(a->>'line1')) between 5 and 200
    and length(trim(a->>'city')) between 2 and 100, false);
$$;

create function public.create_shirt_reservation(p_request_id uuid, p_payload_hash text, p_token_hash text, p_user_id uuid,
  p_customer jsonb, p_address jsonb, p_items jsonb, p_terms text, p_privacy text, p_expires_hours integer default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reservations; i record; v record; rid uuid := gen_random_uuid(); qty integer := 0; total integer := 0; price integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into r from public.reservations where request_id = p_request_id;
  if found then
    if r.payload_hash <> p_payload_hash or r.token_hash <> p_token_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return r.id;
  end if;
  if not private.valid_mainland_address(p_address) then raise exception 'INVALID_MAINLAND_ADDRESS'; end if;
  if length(trim(p_customer->>'name')) not between 2 and 150 or
    coalesce(p_customer->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or
    coalesce(p_customer->>'phone','') !~ '^\+?[0-9 ()-]{9,25}$' then raise exception 'INVALID_CUSTOMER'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 5 then raise exception 'INVALID_ITEMS'; end if;
  if (select count(distinct e->>'sku') from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then raise exception 'DUPLICATE_SKU'; end if;
  if p_expires_hours < 0 or p_expires_hours > 8760 or length(p_terms) < 1 or length(p_privacy) < 1 then raise exception 'INVALID_TERMS'; end if;
  -- Lock variants in one stable order across creation/cancellation/conversion.
  for i in select * from jsonb_to_recordset(p_items) as x(sku text, quantity integer) order by sku loop
    if i.quantity is null or i.quantity < 1 then raise exception 'INVALID_QUANTITY'; end if;
    select pv.*, p.name as product_name into v from public.product_variants pv join public.products p on p.id = pv.product_id
      where pv.sku = i.sku and pv.active and p.slug = 'camiseta-imperial' for update of pv;
    if not found then raise exception 'INVALID_SKU'; end if;
    if v.available_stock < i.quantity then raise exception 'OUT_OF_STOCK'; end if;
    select amount into price from public.product_prices where product_id = v.product_id and currency = 'eur'
      and starts_at <= now() and (ends_at is null or ends_at > now()) order by starts_at desc limit 1;
    if price is distinct from 2999 then raise exception 'PRICE_CONFIGURATION_REQUIRED'; end if;
    qty := qty + i.quantity; total := total + i.quantity * price;
  end loop;
  insert into public.reservations(id,request_id,payload_hash,token_hash,user_id,customer_name,customer_email,customer_phone,
    shipping_address,total_quantity,total_price_snapshot,terms_version,privacy_version,expires_at)
  values(rid,p_request_id,p_payload_hash,p_token_hash,p_user_id,trim(p_customer->>'name'),lower(trim(p_customer->>'email')),
    trim(p_customer->>'phone'),p_address,qty,total,p_terms,p_privacy,case when p_expires_hours > 0 then now() + make_interval(hours=>p_expires_hours) end);
  for i in select * from jsonb_to_recordset(p_items) as x(sku text, quantity integer) order by sku loop
    select pv.*, p.name as product_name into v from public.product_variants pv join public.products p on p.id = pv.product_id where pv.sku = i.sku;
    update public.product_variants set reserved_stock = reserved_stock + i.quantity where id = v.id;
    insert into public.reservation_items(reservation_id,product_id,variant_id,sku,product_name,size,color,quantity,unit_price_snapshot)
      values(rid,v.product_id,v.id,v.sku,v.product_name,v.name,v.color,i.quantity,2999);
  end loop;
  insert into public.commerce_outbox(reservation_id,kind) values(rid,'RESERVED');
  return rid;
end $$;

create function public.release_shirt_reservation(p_id uuid, p_status text default 'CANCELLED') returns boolean
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; i record;
begin
  select * into r from public.reservations where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status = p_status then return false; end if;
  if p_status not in ('CANCELLED','EXPIRED') or r.status not in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_FAILED')
    or exists(select 1 from public.reservation_payment_attempts where reservation_id = p_id and status = 'OPEN') then raise exception 'INVALID_STATE'; end if;
  if p_status = 'EXPIRED' and (r.expires_at is null or r.expires_at > now()) then raise exception 'NOT_EXPIRED'; end if;
  for i in select * from public.reservation_items where reservation_id = p_id order by sku loop
    update public.product_variants set reserved_stock = reserved_stock - i.quantity where id = i.variant_id;
  end loop;
  update public.reservations set status = p_status, cancelled_at = case when p_status = 'CANCELLED' then now() end,
    expired_at = case when p_status = 'EXPIRED' then now() end where id = p_id;
  insert into public.commerce_outbox(reservation_id,kind) values(p_id,p_status) on conflict do nothing;
  return true;
end $$;

create function public.open_shirt_purchase(p_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.reservations set status = 'PURCHASE_AVAILABLE' where id = p_id and status = 'RESERVED' and (expires_at is null or expires_at > now());
  if not found then return false; end if;
  insert into public.commerce_outbox(reservation_id,kind) values(p_id,'PURCHASE_AVAILABLE') on conflict do nothing;
  return true;
end $$;

create function public.begin_shirt_payment(p_id uuid, p_address jsonb, p_terms text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; a public.reservation_payment_attempts; aid uuid;
begin
  if not private.valid_mainland_address(p_address) then raise exception 'INVALID_MAINLAND_ADDRESS'; end if;
  select * into r from public.reservations where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED') then raise exception 'INVALID_STATE'; end if;
  select * into a from public.reservation_payment_attempts where reservation_id = p_id and status = 'OPEN';
  if found then
    if a.shipping_address <> p_address then raise exception 'PAYMENT_ADDRESS_LOCKED'; end if;
    return a.id;
  end if;
  if r.expires_at <= now() then raise exception 'RESERVATION_EXPIRED'; end if;
  update public.reservations set status = 'PAYMENT_PENDING',shipping_address = p_address where id = p_id;
  insert into public.reservation_payment_attempts(reservation_id,shipping_address,terms_version) values(p_id,p_address,p_terms) returning id into aid;
  return aid;
end $$;

create function public.complete_shirt_payment(p_attempt uuid, p_session text, p_intent text, p_total integer, p_currency text, p_tax integer, p_shipping integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.reservation_payment_attempts; r public.reservations; oid uuid; i record;
begin
  select * into a from public.reservation_payment_attempts where id = p_attempt;
  if not found then raise exception 'UNKNOWN_PAYMENT_ATTEMPT'; end if;
  select * into r from public.reservations where id = a.reservation_id for update;
  select * into a from public.reservation_payment_attempts where id = p_attempt for update;
  if a.stripe_session_id is not null and a.stripe_session_id <> p_session then raise exception 'SESSION_MISMATCH'; end if;
  if r.status = 'CONVERTED_TO_ORDER' then
    if r.stripe_checkout_session_id <> p_session or r.stripe_payment_intent_id <> p_intent then raise exception 'DUPLICATE_PAYMENT'; end if;
    return r.order_id;
  end if;
  if a.status <> 'OPEN' or r.status not in ('PAYMENT_PENDING','PAYMENT_FAILED') then raise exception 'INVALID_PAYMENT_STATE'; end if;
  if p_total is distinct from r.total_price_snapshot or p_currency is distinct from 'eur' or p_shipping is distinct from 0
    or p_intent is null or p_tax is null or p_tax < 0 or p_tax > p_total then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;
  insert into public.commerce_orders(reservation_id,reservation_number,customer_name,customer_email,customer_phone,shipping_address,
    total_quantity,subtotal,total,currency,vat_amount,stripe_checkout_session_id,stripe_payment_intent_id)
  values(r.id,r.number,r.customer_name,r.customer_email,r.customer_phone,a.shipping_address,r.total_quantity,p_total,p_total,'eur',p_tax,p_session,p_intent) returning id into oid;
  for i in select * from public.reservation_items where reservation_id = r.id order by sku loop
    update public.product_variants set reserved_stock = reserved_stock - i.quantity, sold_stock = sold_stock + i.quantity where id = i.variant_id;
    insert into public.commerce_order_items(order_id,reservation_item_id,sku,product_name,size,color,quantity,unit_price,line_total,currency)
      values(oid,i.id,i.sku,i.product_name,i.size,i.color,i.quantity,i.unit_price_snapshot,i.line_total_snapshot,i.currency);
  end loop;
  update public.reservation_payment_attempts set status = 'PAID',stripe_session_id = p_session,stripe_payment_intent_id = p_intent where id = a.id;
  update public.reservations set status = 'CONVERTED_TO_ORDER',converted_at = now(),order_id = oid,
    stripe_checkout_session_id = p_session,stripe_payment_intent_id = p_intent where id = r.id;
  insert into public.commerce_outbox(reservation_id,kind) values(r.id,'ORDER_PAID') on conflict do nothing;
  return oid;
end $$;

create function public.close_shirt_payment(p_attempt uuid, p_session text, p_expired boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.reservation_payment_attempts; r public.reservations;
begin
  select * into a from public.reservation_payment_attempts where id = p_attempt;
  if not found then raise exception 'UNKNOWN_PAYMENT_ATTEMPT'; end if;
  select * into r from public.reservations where id = a.reservation_id for update;
  select * into a from public.reservation_payment_attempts where id = p_attempt for update;
  if a.status <> 'OPEN' then return; end if;
  if a.stripe_session_id is not null and a.stripe_session_id <> p_session then raise exception 'SESSION_MISMATCH'; end if;
  update public.reservation_payment_attempts set stripe_session_id = p_session, status = case when p_expired then 'EXPIRED' else 'OPEN' end where id = a.id;
  update public.reservations set status = case when p_expired then 'PURCHASE_AVAILABLE' else 'PAYMENT_FAILED' end where id = r.id and status in ('PAYMENT_PENDING','PAYMENT_FAILED');
end $$;

create function public.claim_commerce_mail() returns setof public.commerce_outbox
language plpgsql security definer set search_path = '' as $$
declare j public.commerce_outbox;
begin
  -- Resend deduplication has a finite window. Ambiguous older attempts need review.
  update public.commerce_outbox set status = 'REVIEW' where status in ('PENDING','PROCESSING') and first_attempt_at < now() - interval '23 hours';
  select * into j from public.commerce_outbox where status = 'PENDING' or (status = 'PROCESSING' and claimed_at < now() - interval '5 minutes') order by created_at for update skip locked limit 1;
  if not found then return; end if;
  return query update public.commerce_outbox set status = 'PROCESSING',claim_id = gen_random_uuid(),claimed_at = now(),
    first_attempt_at = coalesce(first_attempt_at,now()),attempts = attempts + 1 where id = j.id returning *;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('create_shirt_reservation','release_shirt_reservation','open_shirt_purchase','begin_shirt_payment','complete_shirt_payment','close_shirt_payment','claim_commerce_mail') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
