begin;
do $$
declare r uuid; j uuid:=gen_random_uuid(); other_job uuid:=gen_random_uuid(); claimed integer;
begin
  if has_function_privilege('anon','public.claim_commerce_mail_by_id(uuid)','EXECUTE') or
    has_function_privilege('authenticated','public.claim_commerce_mail_by_id(uuid)','EXECUTE') then
    raise exception 'Targeted mail claim exposed publicly';
  end if;
  select id into r from public.reservations limit 1;
  if r is null then raise exception 'Test fixture reservation required';end if;
  insert into public.commerce_outbox(id,reservation_id,kind,version) values
    (j,r,'RESHIP_EMAIL',gen_random_uuid()),(other_job,r,'RESHIP_EMAIL',gen_random_uuid());
  select count(*) into claimed from public.claim_commerce_mail_by_id(j);
  if claimed<>1 then raise exception 'Target not claimed';end if;
  if (select status from public.commerce_outbox where id=other_job)<>'PENDING' then raise exception 'Claim touched unrelated job';end if;
  select count(*) into claimed from public.claim_commerce_mail_by_id(j);
  if claimed<>0 then raise exception 'Active lease reclaimed';end if;
  update public.commerce_outbox set claimed_at=now()-interval '6 minutes' where id=j;
  select count(*) into claimed from public.claim_commerce_mail_by_id(j);
  if claimed<>1 then raise exception 'Expired lease not reclaimed';end if;
  update public.commerce_outbox set first_attempt_at=now()-interval '24 hours' where id=j;
  select count(*) into claimed from public.claim_commerce_mail_by_id(j);
  if claimed<>0 or (select status from public.commerce_outbox where id=j)<>'REVIEW' then raise exception 'Ambiguous old send retried';end if;
  update public.commerce_outbox set status='SENT' where id=other_job;
  select count(*) into claimed from public.claim_commerce_mail_by_id(other_job);
  if claimed<>0 then raise exception 'Sent mail reclaimed';end if;
end $$;
rollback;
select true as targeted_mail_test_passed;
