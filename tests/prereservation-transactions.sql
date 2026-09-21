begin;
update public.commerce_campaign set max_reservation_quantity=2,purchase_window_hours=24,
  purchase_activated=false,reservations_open_at=null,purchase_open_at=null;
do $$
declare rid uuid; wid uuid; wid2 uuid; invited uuid; before_stock integer; failed boolean;
  c jsonb:='{"name":"Prueba minima","email":"MINIMAL@example.invalid"}';
  items jsonb:='[{"sku":"IE-CAMISETA-IMPERIAL-S","quantity":1}]';
begin
  select available_stock into before_stock from public.product_variants where sku='IE-CAMISETA-IMPERIAL-S';
  if before_stock<1 then raise exception 'TEST_REQUIRES_AVAILABLE_S'; end if;
  rid:=public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,c,null,items,'2026-09-12','2026-09-12');
  if not exists(select 1 from public.reservations where id=rid and shipping_address is null and customer_phone is null
    and marketing_consent=false and marketing_accepted_at is null and customer_email='minimal@example.invalid') then raise exception 'MINIMIZATION_FAILED'; end if;
  if exists(select 1 from public.reservation_payment_attempts where reservation_id=rid) then raise exception 'FREE_RESERVATION_CREATED_PAYMENT'; end if;
  perform public.release_shirt_reservation(rid,'CANCELLED');
  perform public.release_shirt_reservation(rid,'CANCELLED');
  if (select available_stock from public.product_variants where sku='IE-CAMISETA-IMPERIAL-S')<>before_stock then raise exception 'CANCEL_STOCK'; end if;
  failed:=false;
  begin perform public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,c,null,
    '[{"sku":"IE-CAMISETA-IMPERIAL-S","quantity":3}]','2026-09-12','2026-09-12'); exception when others then
    if sqlerrm<>'MAX_RESERVATION_QUANTITY' then raise; end if; failed:=true; end;
  if not failed then raise exception 'MAX_NOT_ENFORCED'; end if;
  -- Change only this transaction's saleable stock; ROLLBACK restores the real Test snapshot.
  update public.product_variants set physical_stock=reserved_stock+sold_stock where sku='IE-CAMISETA-IMPERIAL-S';
  failed:=false;
  begin perform public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,c,null,items,'2026-09-12','2026-09-12');
    exception when others then if sqlerrm<>'OUT_OF_STOCK' then raise; end if; failed:=true; end;
  if not failed then raise exception 'OVERSOLD'; end if;
  wid:=public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,c,null,items,'2026-09-12','2026-09-12',0,true,true);
  if not exists(select 1 from public.reservations where id=wid and status='WAITLIST' and marketing_consent and marketing_accepted_at is not null) then raise exception 'WAITLIST_OR_CONSENT'; end if;
  if (select available_stock from public.product_variants where sku='IE-CAMISETA-IMPERIAL-S')<>0 then raise exception 'WAITLIST_CHANGED_STOCK'; end if;
  wid2:=public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,
    '{"name":"Prueba segunda","email":"second@example.invalid"}',null,items,'2026-09-12','2026-09-12',0,false,true);
  update public.reservations set created_at=created_at-interval '1 minute' where id=wid;
  update public.product_variants set physical_stock=physical_stock+1 where sku='IE-CAMISETA-IMPERIAL-S';
  invited:=public.invite_next_shirt_waitlist('IE-CAMISETA-IMPERIAL-S',null);
  if invited<>wid then raise exception 'FIFO_FAILED'; end if;
  if not exists(select 1 from public.reservations where id=wid and status='RESERVED' and expires_at=now()+interval '24 hours') then raise exception 'INVITATION_DEADLINE'; end if;
  if (select status from public.reservations where id=wid2)<>'WAITLIST' then raise exception 'SECOND_WAITLIST_ASSIGNED'; end if;
  perform public.release_shirt_reservation(wid2,'CANCELLED');
  update public.reservations set expires_at=now()-interval '1 second' where id=wid;
  perform public.release_shirt_reservation(wid,'EXPIRED');
  perform public.release_shirt_reservation(wid,'EXPIRED');
  if (select available_stock from public.product_variants where sku='IE-CAMISETA-IMPERIAL-S')<>1 then raise exception 'EXPIRATION_FAILED'; end if;
  rid:=public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,c,null,items,'2026-09-12','2026-09-12');
  failed:=false;
  begin perform public.open_shirt_purchase(rid); exception when others then
    if sqlerrm<>'CAMPAIGN_NOT_OPEN' then raise; end if; failed:=true; end;
  if not failed then raise exception 'UNAPPROVED_CAMPAIGN_OPENED'; end if;
  update public.commerce_campaign set purchase_activated=true;
  perform public.open_shirt_purchase(rid);
  if not exists(select 1 from public.reservations where id=rid and status='PURCHASE_AVAILABLE' and expires_at=now()+interval '24 hours') then raise exception 'PURCHASE_WINDOW'; end if;
  if public.open_shirt_purchase(rid) then raise exception 'INVITATION_DUPLICATED'; end if;
end $$;
select 'Minimal data, maximum, sold out, waitlist, FIFO, optional consent, cancellation, expiry and campaign assertions passed' as result;
rollback;
