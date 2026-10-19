begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();own_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();denied boolean:=false;
begin
  if has_table_privilege('anon','public.legal_consents','SELECT') or has_table_privilege('anon','public.legal_consents','TRUNCATE') or
    has_table_privilege('authenticated','public.legal_consents','INSERT') or has_table_privilege('authenticated','public.legal_consents','UPDATE') or
    has_table_privilege('authenticated','public.legal_consents','DELETE') or has_table_privilege('authenticated','public.legal_consents','TRUNCATE') or
    not has_table_privilege('authenticated','public.legal_consents','SELECT') or
    not has_table_privilege('service_role','public.legal_consents','INSERT') then raise exception 'Consent grant boundary invalid';end if;
  insert into auth.users(id,email,raw_user_meta_data) values(a,'consent-a-'||a||'@example.invalid','{}'),(b,'consent-b-'||b||'@example.invalid','{}');
  insert into public.legal_consents(id,user_id,consent_type,document_version,accepted,source) values
    (own_id,a,'privacy_acknowledgement','test',true,'test'),(other_id,b,'privacy_acknowledgement','test',true,'test');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',a::text,true);
  set local role authenticated;
  if (select count(*) from public.legal_consents where id in (own_id,other_id))<>1 then raise exception 'Own consent RLS failed';end if;
  begin
    update public.legal_consents set accepted=false where id=own_id;
  exception when insufficient_privilege then denied:=true;end;
  if not denied then raise exception 'Browser role changed consent evidence';end if;
  reset role;
  if not(select accepted from public.legal_consents where id=own_id) then raise exception 'Rejected update changed evidence';end if;
end $$;
rollback;
select true as consent_privileges_test_passed;
