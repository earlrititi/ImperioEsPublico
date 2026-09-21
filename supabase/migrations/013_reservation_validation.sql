alter table public.reservations add constraint reservation_phone_digits check (length(regexp_replace(customer_phone,'[^0-9]','','g')) between 9 and 15);
alter table public.reservations add constraint reservation_customer_lengths check (length(customer_name) between 2 and 150 and length(customer_email) <= 254);
alter table public.product_variants alter column color set default 'Blanco / negro - Diseno Imperial';
update public.product_variants set color='Blanco / negro - Diseno Imperial'
  where color='Diseno Imperial' and product_id in (select id from public.products where slug='camiseta-imperial');
