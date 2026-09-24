-- NULL removes the per-reservation cap; atomic inventory checks still apply.
alter table public.commerce_campaign
  alter column max_reservation_quantity drop not null,
  alter column max_reservation_quantity drop default;

update public.commerce_campaign
set max_reservation_quantity = null, updated_at = now()
where id = 'shirt-first-edition';
