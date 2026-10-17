begin;
do $$
declare source public.commerce_orders; oid uuid:=gen_random_uuid(); rid uuid; job public.paid_order_admin_outbox; claimed integer;
begin
  if not(select c.relrowsecurity from pg_class c where c.oid='public.paid_order_admin_outbox'::regclass) or
    has_table_privilege('anon','public.paid_order_admin_outbox','SELECT') or has_table_privilege('authenticated','public.paid_order_admin_outbox','UPDATE') or
    has_function_privilege('anon','public.claim_paid_order_admin_notice(uuid)','EXECUTE') or
    has_function_privilege('authenticated','public.finish_paid_order_admin_notice(uuid,uuid,text)','EXECUTE') then raise exception 'Private notice exposed';end if;
  select * into source from public.commerce_orders limit 1;
  if source.id is null then raise exception 'Paid Test order required';end if;
  rid:=public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,
    '{"name":"SQL Test","email":"sql-notice@example.invalid"}',
    '{"name":"SQL Test","line1":"Calle Test 1","postalCode":"28001","city":"Madrid","province":"28","country":"ES"}',
    '[{"sku":"IE-CAMISETA-IMPERIAL-M","quantity":1}]','test','test',0,false,false);
  insert into public.commerce_orders select (jsonb_populate_record(null::public.commerce_orders,to_jsonb(source)||jsonb_build_object(
    'id',oid,'number','PED-TEST-'||oid,'reservation_id',rid,'stripe_checkout_session_id','cs_test_sql_'||oid,'stripe_payment_intent_id','pi_sql_'||oid))).*;
  if not exists(select 1 from public.paid_order_admin_outbox where order_id=oid and status='PENDING') then raise exception 'Atomic order trigger missing';end if;
  select * into job from public.claim_paid_order_admin_notice(oid);
  if job.status<>'PROCESSING' or job.attempts<>1 then raise exception 'Order notice not leased';end if;
  select count(*) into claimed from public.claim_paid_order_admin_notice(oid);
  if claimed<>0 then raise exception 'Active order notice leased twice';end if;
  if public.finish_paid_order_admin_notice(oid,gen_random_uuid(),'fake-provider') then raise exception 'Foreign claim completed';end if;
  if not public.finish_paid_order_admin_notice(oid,job.claim_id,'test-provider') then raise exception 'Notice not completed';end if;
  if not exists(select 1 from public.admin_notification_history where id='paid_order_admin_'||oid and kind='paid_order') then raise exception 'Dashboard receipt missing';end if;
  select count(*) into claimed from public.claim_paid_order_admin_notice(oid);
  if claimed<>0 then raise exception 'Sent notice leased again';end if;
  update public.paid_order_admin_outbox set status='PROCESSING',first_attempt_at=now()-interval '24 hours',claimed_at=now()-interval '10 minutes' where order_id=oid;
  select count(*) into claimed from public.claim_paid_order_admin_notice(oid);
  if claimed<>0 or (select status from public.paid_order_admin_outbox where order_id=oid)<>'REVIEW' then raise exception 'Ambiguous aged send retried';end if;
end $$;
rollback;
select true as paid_order_admin_notice_test_passed;
