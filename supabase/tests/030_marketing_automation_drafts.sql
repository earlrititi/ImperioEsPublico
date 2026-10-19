begin;
do $$
declare
  actor uuid:=gen_random_uuid();
  result integer;
  queued bigint;
  original jsonb:='[{"id":"hour4","afterHours":4,"mail":{"subject":"Prueba","preheader":"","content":"Solo Test","cta_label":"","cta_url":""}}]';
begin
  if not (select relrowsecurity from pg_class where oid='public.marketing_automation_drafts'::regclass) then
    raise exception 'Draft table must use RLS';
  end if;
  if has_table_privilege('anon','public.marketing_automation_drafts','SELECT') or
    has_table_privilege('authenticated','public.marketing_automation_drafts','INSERT') or
    has_function_privilege('anon','public.save_marketing_automation_draft(text,uuid,integer,jsonb)','EXECUTE') or
    has_function_privilege('authenticated','public.save_marketing_automation_draft(text,uuid,integer,jsonb)','EXECUTE') then
    raise exception 'Public access to private drafts';
  end if;
  select count(*) into queued from public.email_logs;
  insert into auth.users(id,email,raw_user_meta_data) values(actor,'automation-'||actor||'@example.invalid','{}');
  -- An existing draft must remain unchanged once this transaction rolls back.
  delete from public.marketing_automation_drafts where key='cart';
  result:=public.save_marketing_automation_draft('cart',actor,0,original);
  if result<>1 then raise exception 'First draft revision';end if;
  result:=public.save_marketing_automation_draft('cart',actor,1,original);
  if result<>2 then raise exception 'Updated draft revision';end if;
  if not exists(select 1 from public.commerce_audit a join public.marketing_automation_drafts d on a.entity_id=d.id
    where d.key='cart' and a.actor_id=actor and a.entity='email_automation' and a.action='AUTOMATION_DRAFT_SAVED:cart:2') then
    raise exception 'Draft audit missing';
  end if;
  begin
    perform public.save_marketing_automation_draft('cart',actor,1,original);
    raise exception 'Stale draft accepted';
  exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise;end if;end;
  begin
    perform public.save_marketing_automation_draft('placed_order',actor,0,original);
    raise exception 'Transactional channel overwritten';
  exception when others then if sqlerrm<>'INVALID_INPUT' then raise;end if;end;
  if (select revision from public.marketing_automation_drafts where key='cart')<>2 then raise exception 'Conflict changed draft';end if;
  if (select count(*) from public.email_logs)<>queued then raise exception 'Draft unexpectedly queued mail';end if;
end $$;
rollback;
select true as automation_drafts_test_passed;
