alter table public.reservation_payment_attempts
  add column shipping_method text,
  add column shipping_amount integer,
  add constraint reservation_payment_shipping_option check (
    (shipping_method is null and shipping_amount is null)
    or (shipping_method = 'standard' and shipping_amount = 0) is true
    or (shipping_method = 'priority' and shipping_amount = 699) is true
  );

alter table public.commerce_orders
  add column shipping_method text,
  add constraint commerce_order_shipping_option check (
    shipping_method is null
    or (shipping_method = 'standard' and shipping_amount = 0) is true
    or (shipping_method = 'priority' and shipping_amount = 699) is true
  );

comment on column public.reservation_payment_attempts.shipping_method is 'Delivery option selected before payment. NULL uses the previous per-unit shipping contract.';
comment on column public.reservation_payment_attempts.shipping_amount is 'VAT-inclusive delivery amount in cents for the whole payment attempt.';
comment on column public.commerce_orders.shipping_amount is 'VAT-inclusive postage in cents. Orders without a delivery option may use the historical per-unit amount.';

drop function public.begin_shirt_payment(uuid, jsonb, text, jsonb);
create function public.begin_shirt_payment(
  p_id uuid, p_address jsonb, p_terms text,
  p_customer jsonb default null, p_shipping_method text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations;
  a public.reservation_payment_attempts;
  aid uuid;
  cname text;
  email text;
  delivery_amount integer;
begin
  if p_shipping_method is not null and p_shipping_method not in ('standard', 'priority') then
    raise exception 'INVALID_SHIPPING_METHOD';
  end if;
  delivery_amount := case p_shipping_method when 'standard' then 0 when 'priority' then 699 end;
  if not private.valid_mainland_address(p_address) then raise exception 'INVALID_MAINLAND_ADDRESS'; end if;
  select * into r from public.reservations where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('PURCHASE_AVAILABLE', 'PAYMENT_PENDING', 'PAYMENT_FAILED') then raise exception 'INVALID_STATE'; end if;
  if r.expires_at <= now() then raise exception 'RESERVATION_EXPIRED'; end if;
  cname := case when p_customer is null then r.customer_name else trim(p_customer->>'name') end;
  email := case when p_customer is null then r.customer_email else lower(trim(p_customer->>'email')) end;
  if coalesce(length(cname), 0) not between 2 and 150
    or coalesce(email, '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(email) > 254 then raise exception 'INVALID_CUSTOMER'; end if;
  select * into a from public.reservation_payment_attempts where reservation_id = p_id and status = 'OPEN';
  if found then
    if a.shipping_address <> p_address or r.customer_name <> cname or r.customer_email <> email then
      raise exception 'PAYMENT_ADDRESS_LOCKED';
    end if;
    if p_shipping_method is not null and a.shipping_method is distinct from p_shipping_method then
      raise exception 'PAYMENT_SHIPPING_LOCKED';
    end if;
    return a.id;
  end if;
  update public.reservations set status = 'PAYMENT_PENDING', shipping_address = p_address,
    customer_name = cname, customer_email = email where id = p_id;
  insert into public.reservation_payment_attempts(
    reservation_id, shipping_address, terms_version, shipping_method, shipping_amount
  ) values (p_id, p_address, p_terms, p_shipping_method, delivery_amount) returning id into aid;
  return aid;
end $$;

revoke all on function public.begin_shirt_payment(uuid, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.begin_shirt_payment(uuid, jsonb, text, jsonb, text) to service_role;

create or replace function public.set_shirt_order_breakdown()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reservation_id is not null then
    if new.total_quantity < 1 or new.total::bigint + new.discount_amount <> new.subtotal then
      raise exception 'PAYMENT_TOTAL_MISMATCH';
    end if;
    if new.shipping_method is null then
      if new.subtotal <> new.total_quantity::bigint * 2999 then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;
      new.shipping_amount := new.total_quantity * 300;
    elsif new.shipping_amount is null or new.subtotal <> new.total_quantity::bigint * 2699 + new.shipping_amount then
      raise exception 'PAYMENT_TOTAL_MISMATCH';
    end if;
    new.product_subtotal := new.subtotal - new.shipping_amount;
    if new.discount_amount > new.product_subtotal then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;
  end if;
  return new;
end $$;

create or replace function public.complete_shirt_payment(
  p_attempt uuid, p_session text, p_intent text, p_total integer,
  p_currency text, p_tax integer, p_shipping integer, p_discount integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  a public.reservation_payment_attempts;
  r public.reservations;
  oid uuid;
  i record;
  gross_total integer;
  order_unit_price integer;
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
  if a.status <> 'OPEN' or r.status not in ('PAYMENT_PENDING', 'PAYMENT_FAILED') then raise exception 'INVALID_PAYMENT_STATE'; end if;
  gross_total := case when a.shipping_method is null then r.total_price_snapshot
    else r.total_quantity * 2699 + a.shipping_amount end;
  if a.expected_total is null or p_total is distinct from a.expected_total or p_discount is distinct from a.discount_amount
    or p_total::bigint + p_discount is distinct from gross_total or p_currency is distinct from 'eur'
    or p_shipping is distinct from coalesce(a.shipping_amount, 0)
    or p_intent is null or p_tax is null or p_tax < 0 or p_tax > p_total then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;
  insert into public.commerce_orders(
    reservation_id, reservation_number, customer_name, customer_email, customer_phone, shipping_address,
    total_quantity, subtotal, total, currency, vat_amount, discount_amount, promotion_lead_id,
    stripe_checkout_session_id, stripe_payment_intent_id, shipping_method, shipping_amount
  ) values (
    r.id, r.number, r.customer_name, r.customer_email, r.customer_phone, a.shipping_address,
    r.total_quantity, gross_total, p_total, 'eur', p_tax, p_discount, a.promotion_lead_id,
    p_session, p_intent, a.shipping_method, a.shipping_amount
  ) returning id into oid;
  for i in select * from public.reservation_items where reservation_id = r.id order by sku loop
    update public.product_variants set reserved_stock = reserved_stock - i.quantity, sold_stock = sold_stock + i.quantity
      where id = i.variant_id;
    order_unit_price := case when a.shipping_method is null then i.unit_price_snapshot else 2699 end;
    insert into public.commerce_order_items(order_id, reservation_item_id, sku, product_name, size, color, quantity, unit_price, line_total, currency)
      values (oid, i.id, i.sku, i.product_name, i.size, i.color, i.quantity, order_unit_price, i.quantity * order_unit_price, i.currency);
  end loop;
  update public.reservation_payment_attempts set status = 'PAID', stripe_session_id = p_session, stripe_payment_intent_id = p_intent
    where id = a.id;
  update public.reservations set status = 'CONVERTED_TO_ORDER', converted_at = now(), order_id = oid,
    stripe_checkout_session_id = p_session, stripe_payment_intent_id = p_intent where id = r.id;
  if a.promotion_lead_id is not null then
    update public.marketing_leads set redeemed_at = now(), updated_at = now() where id = a.promotion_lead_id and redeemed_at is null;
  end if;
  insert into public.commerce_outbox(reservation_id, kind) values (r.id, 'ORDER_PAID') on conflict do nothing;
  return oid;
end $$;

notify pgrst, 'reload schema';
