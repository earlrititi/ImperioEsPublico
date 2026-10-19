do $$
declare
  uid uuid:=gen_random_uuid(); unverified uuid:=gen_random_uuid(); consent uuid:=gen_random_uuid();
  email text; job uuid; claimed public.marketing_automation_jobs; proof public.commerce_orders;
  rid uuid; oid uuid:=gen_random_uuid(); initial_emails bigint;
begin
  email:='automation-'||uid||'@example.invalid';
  select count(*) into initial_emails from public.email_logs;
  if (select enabled from public.marketing_automation_runtime where id) then raise exception 'Automation enabled by migration';end if;
  if has_table_privilege('anon','public.marketing_automation_jobs','SELECT') or
    has_table_privilege('authenticated','public.marketing_automation_subjects','SELECT') or
    has_function_privilege('anon','public.claim_marketing_automation()','EXECUTE') or
    has_function_privilege('authenticated','public.record_marketing_automation_activity(uuid,text,text)','EXECUTE') then raise exception 'Private automation data exposed';end if;
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,created_at) values(uid,email,now()-interval '3 days','{}',now()-interval '3 days'),
    (unverified,'unverified-'||unverified||'@example.invalid',null,'{}',now()-interval '3 days');
  insert into public.profiles(id,email) values(uid,email),(unverified,'unverified-'||unverified||'@example.invalid') on conflict(id) do nothing;
  insert into public.legal_consents(id,user_id,consent_type,document_version,accepted,source,created_at)
    values(consent,uid,'marketing_email','test',true,'test',now()-interval '2 days');
  insert into public.legal_consents(user_id,consent_type,document_version,accepted,source,created_at) values
    (uid,'cookies_analytics','2026-10-16',true,'test',now()-interval '2 days'),
    (unverified,'marketing_email','test',true,'test',now()-interval '2 days');
  if not exists(select 1 from public.marketing_automation_subjects where user_id=uid) or
    exists(select 1 from public.marketing_automation_subjects where user_id=unverified) then raise exception 'Email verification boundary failed';end if;
  if public.record_marketing_automation_activity(uid,'cart','old-policy') then raise exception 'Outdated analytics consent accepted';end if;
  if not public.record_marketing_automation_activity(uid,'cart','2026-10-16') then raise exception 'Eligible activity refused';end if;
  if public.record_marketing_automation_activity(unverified,'site','2026-10-16') then raise exception 'Unverified identity tracked';end if;
  if public.queue_marketing_automation(uid,consent,'cart','hour4',now()-interval '6 hours',now()-interval '2 hours',0,repeat('a',64)) is not null then raise exception 'Disabled automation queued';end if;
  select * into proof from public.commerce_orders limit 1;
  if proof.id is null then raise exception 'Paid Test proof required';end if;
  update public.marketing_automation_runtime set enabled=true,approved_by=uid,approved_at=now(),template_digest=repeat('a',64),purchase_proof_id=proof.id;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='marketing_automation_runtime' and column_name='enrollment_starts_at') then
    execute 'update public.marketing_automation_runtime set enrollment_starts_at=now()-interval ''4 days''';
  end if;
  job:=public.queue_marketing_automation(uid,consent,'cart','hour4',now()-interval '6 hours',now()-interval '2 hours',0,repeat('a',64));
  if job is null then raise exception 'Eligible automation not queued';end if;
  if public.queue_marketing_automation(uid,consent,'checkout','hour1',now()-interval '6 hours',now()-interval '2 hours',0,repeat('a',64)) is not null then raise exception 'Duplicate active enrolment';end if;
  select * into claimed from public.claim_marketing_automation();
  if claimed.id<>job or claimed.status<>'processing' then raise exception 'Automation lease missing';end if;
  if exists(select 1 from public.claim_marketing_automation()) then raise exception 'Active lease reused';end if;
  if not public.record_marketing_automation_activity(uid,'cart_cleared','2026-10-16') then raise exception 'Empty cart signal refused';end if;
  if (select status from public.marketing_automation_jobs where id=job)<>'suppressed' then raise exception 'Empty cart still receives recovery';end if;
  job:=public.queue_marketing_automation(uid,consent,'welcome','day1',now()-interval '2 days',now()-interval '1 day',0,repeat('a',64));
  if job is null then raise exception 'Welcome not queued';end if;
  insert into public.legal_consents(user_id,consent_type,document_version,accepted,source,withdrawn_at)
    values(uid,'cookies_analytics','2026-10-16',false,'test',now());
  if (select status from public.marketing_automation_jobs where id=job)<>'pending' then raise exception 'Analytics withdrawal cancelled email-only welcome';end if;
  insert into public.email_suppressions(email) values(email);
  if (select status from public.marketing_automation_jobs where id=job)<>'suppressed' then raise exception 'Unsubscribe did not cancel welcome';end if;
  if exists(select 1 from public.marketing_automation_subjects where user_id=uid) then raise exception 'Unsubscribed user still eligible';end if;
  insert into public.marketing_automation_jobs(user_id,consent_id,key,step,anchor,due_at,revision,template_digest)
    values(uid,consent,'checkout','hour1',now()-interval '3 hours',now()-interval '2 hours',0,repeat('a',64)) returning id into job;
  insert into public.legal_consents(user_id,consent_type,document_version,accepted,source,withdrawn_at)
    values(uid,'marketing_email','test',false,'test',now());
  if (select status from public.marketing_automation_jobs where id=job)<>'suppressed' then raise exception 'Email withdrawal not immediate';end if;
  insert into public.marketing_automation_jobs(user_id,consent_id,key,step,anchor,due_at,revision,template_digest)
    values(uid,consent,'checkout','hour24',now()-interval '2 days',now()-interval '1 day',0,repeat('a',64)) returning id into job;
  rid:=public.create_shirt_reservation(gen_random_uuid(),repeat('a',64),repeat('b',64),null,
    jsonb_build_object('name','Automation SQL Test','email',email),
    '{"name":"Test","line1":"Calle Test 1","postalCode":"28001","city":"Madrid","province":"28","country":"ES"}',
    '[{"sku":"IE-CAMISETA-IMPERIAL-M","quantity":1}]','test','test',0,false,false);
  insert into public.commerce_orders select (jsonb_populate_record(null::public.commerce_orders,to_jsonb(proof)||jsonb_build_object(
    'id',oid,'number','PED-AUTOMATION-'||oid,'reservation_id',rid,'customer_email',email,'stripe_checkout_session_id','cs_test_sql_'||oid,'stripe_payment_intent_id','pi_sql_'||oid))).*;
  if (select status from public.marketing_automation_jobs where id=job)<>'suppressed' then raise exception 'Payment did not cancel sequence atomically';end if;
  if not exists(select 1 from public.paid_order_admin_outbox where order_id=oid and status='PENDING') then raise exception 'Marketing broke paid-order owner notice';end if;
  if (select count(*) from public.email_logs)<>initial_emails then raise exception 'Automation reused newsletter queue';end if;
end $$;
