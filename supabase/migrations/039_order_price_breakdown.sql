-- Preserve existing order snapshots. Only new shirt orders gain an explicit
-- product/shipping breakdown; subtotal retains its legacy gross meaning.
revoke select on public.product_variants from public, anon, authenticated;

alter table public.commerce_orders
  add column if not exists product_subtotal integer check (product_subtotal >= 0),
  add column if not exists shipping_amount integer check (shipping_amount >= 0);

create or replace function public.set_shirt_order_breakdown()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reservation_id is not null then
    if new.total_quantity < 1 or new.subtotal <> new.total_quantity::bigint * 2999
      or new.total::bigint + new.discount_amount <> new.subtotal then
      raise exception 'PAYMENT_TOTAL_MISMATCH';
    end if;
    new.shipping_amount := new.total_quantity * 300;
    new.product_subtotal := new.subtotal - new.shipping_amount;
    if new.discount_amount > new.product_subtotal then
      raise exception 'PAYMENT_TOTAL_MISMATCH';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.set_shirt_order_breakdown() from public, anon, authenticated;
create trigger shirt_order_price_breakdown before insert on public.commerce_orders
for each row execute function public.set_shirt_order_breakdown();

comment on column public.commerce_orders.product_subtotal is 'Shirts including VAT before discounts, excluding shipping. NULL for historical orders.';
comment on column public.commerce_orders.shipping_amount is 'Actual per-unit mainland postage including VAT. NULL for historical orders.';
