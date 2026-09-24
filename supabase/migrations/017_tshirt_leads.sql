create table public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 150),
  email text not null,
  source text not null check (source = 'tshirt_20_popup'),
  privacy_version text not null,
  privacy_accepted_at timestamptz not null default now(),
  marketing_version text not null,
  marketing_accepted_at timestamptz not null default now(),
  stripe_coupon_id text,
  stripe_promotion_code_id text unique,
  promotion_code text unique,
  email_sent_at timestamptz,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, source),
  check (email = lower(email)),
  check ((stripe_promotion_code_id is null) = (promotion_code is null))
);

alter table public.marketing_leads enable row level security;
revoke all on table public.marketing_leads from public, anon, authenticated;
grant all on table public.marketing_leads to service_role;

alter table public.reservation_payment_attempts
  add column expected_total integer,
  add column discount_amount integer not null default 0 check (discount_amount >= 0),
  add column promotion_lead_id uuid references public.marketing_leads(id) on delete set null;

alter table public.commerce_orders
  add column discount_amount integer not null default 0 check (discount_amount >= 0),
  add column promotion_lead_id uuid references public.marketing_leads(id) on delete set null;

drop function public.complete_shirt_payment(uuid,text,text,integer,text,integer,integer);
create function public.complete_shirt_payment(p_attempt uuid,p_session text,p_intent text,p_total integer,p_currency text,p_tax integer,p_shipping integer,p_discount integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.reservation_payment_attempts; r public.reservations; oid uuid; i record;
begin
  select * into a from public.reservation_payment_attempts where id=p_attempt;
  if not found then raise exception 'UNKNOWN_PAYMENT_ATTEMPT'; end if;
  select * into r from public.reservations where id=a.reservation_id for update;
  select * into a from public.reservation_payment_attempts where id=p_attempt for update;
  if a.stripe_session_id is not null and a.stripe_session_id<>p_session then raise exception 'SESSION_MISMATCH'; end if;
  if r.status='CONVERTED_TO_ORDER' then
    if r.stripe_checkout_session_id<>p_session or r.stripe_payment_intent_id<>p_intent then raise exception 'DUPLICATE_PAYMENT'; end if;
    return r.order_id;
  end if;
  if a.status<>'OPEN' or r.status not in ('PAYMENT_PENDING','PAYMENT_FAILED') then raise exception 'INVALID_PAYMENT_STATE'; end if;
  if a.expected_total is null or p_total is distinct from a.expected_total or p_discount is distinct from a.discount_amount
    or p_total+p_discount is distinct from r.total_price_snapshot or p_currency is distinct from 'eur' or p_shipping is distinct from 0
    or p_intent is null or p_tax is null or p_tax<0 or p_tax>p_total then raise exception 'PAYMENT_TOTAL_MISMATCH'; end if;
  insert into public.commerce_orders(reservation_id,reservation_number,customer_name,customer_email,customer_phone,shipping_address,
    total_quantity,subtotal,total,currency,vat_amount,discount_amount,promotion_lead_id,stripe_checkout_session_id,stripe_payment_intent_id)
  values(r.id,r.number,r.customer_name,r.customer_email,r.customer_phone,a.shipping_address,r.total_quantity,r.total_price_snapshot,p_total,'eur',p_tax,p_discount,a.promotion_lead_id,p_session,p_intent) returning id into oid;
  for i in select * from public.reservation_items where reservation_id=r.id order by sku loop
    update public.product_variants set reserved_stock=reserved_stock-i.quantity,sold_stock=sold_stock+i.quantity where id=i.variant_id;
    insert into public.commerce_order_items(order_id,reservation_item_id,sku,product_name,size,color,quantity,unit_price,line_total,currency)
      values(oid,i.id,i.sku,i.product_name,i.size,i.color,i.quantity,i.unit_price_snapshot,i.line_total_snapshot,i.currency);
  end loop;
  update public.reservation_payment_attempts set status='PAID',stripe_session_id=p_session,stripe_payment_intent_id=p_intent where id=a.id;
  update public.reservations set status='CONVERTED_TO_ORDER',converted_at=now(),order_id=oid,stripe_checkout_session_id=p_session,stripe_payment_intent_id=p_intent where id=r.id;
  if a.promotion_lead_id is not null then update public.marketing_leads set redeemed_at=now(),updated_at=now() where id=a.promotion_lead_id and redeemed_at is null; end if;
  insert into public.commerce_outbox(reservation_id,kind) values(r.id,'ORDER_PAID') on conflict do nothing;
  return oid;
end $$;

revoke all on function public.complete_shirt_payment(uuid,text,text,integer,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.complete_shirt_payment(uuid,text,text,integer,text,integer,integer,integer) to service_role;
