begin;
do $$ declare older uuid:=gen_random_uuid(); newer uuid:=gen_random_uuid(); cid uuid; proof uuid; target uuid;
begin
  if has_table_privilege('authenticated','public.marketing_automation_enrolled_subjects','SELECT') or
    has_table_privilege('anon','public.marketing_automation_enrolled_subjects','SELECT') then raise exception 'Prospective audience exposed';end if;
  insert into auth.users(id,email,email_confirmed_at,created_at) values
    (older,'old-'||older||'@example.invalid',now()-interval '1 day',now()-interval '4 days'),
    (newer,'new-'||newer||'@example.invalid',now()-interval '2 days',now()-interval '2 days');
  insert into public.profiles(id,email) values(older,'old-'||older||'@example.invalid'),(newer,'new-'||newer||'@example.invalid') on conflict(id) do nothing;
  insert into public.legal_consents(user_id,consent_type,document_version,accepted,source,created_at)
    values(older,'marketing_email','test',true,'test',now()-interval '1 day');
  insert into public.legal_consents(user_id,consent_type,document_version,accepted,source,created_at)
    values(newer,'marketing_email','test',true,'test',now()-interval '2 days') returning id into cid;
  select id into proof from public.commerce_orders where total>0 limit 1;
  if proof is null then raise exception 'Paid Test proof required';end if;
  update public.marketing_automation_runtime set enabled=true,approved_by=newer,approved_at=now(),purchase_proof_id=proof,
    enrollment_starts_at=now()-interval '3 days',template_digest=repeat('b',64);
  if exists(select 1 from public.marketing_automation_enrolled_subjects where user_id=older) then raise exception 'Historical account enrolled';end if;
  if not exists(select 1 from public.marketing_automation_enrolled_subjects where user_id=newer) then raise exception 'New verified account excluded';end if;
  target:=public.queue_marketing_automation(older,(select id from public.legal_consents where user_id=older and consent_type='marketing_email' limit 1),
    'welcome','day1',now()-interval '1 day',now(),0,repeat('b',64));
  if target is not null then raise exception 'Historical welcome queued';end if;
  target:=public.queue_marketing_automation(newer,cid,'welcome','day1',now()-interval '2 days',now()-interval '1 day',0,repeat('b',64));
  if target is null then raise exception 'Prospective welcome not queued';end if;
  update public.marketing_automation_runtime set enrollment_starts_at=null;
  if exists(select 1 from public.marketing_automation_enrolled_subjects where user_id in(older,newer)) then raise exception 'Missing activation cutoff allowed';end if;
end $$;
rollback;
select true as verified;
