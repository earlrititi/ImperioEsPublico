begin;
do $$ declare definition text; begin
  definition:=pg_get_functiondef('private.dispatch_commerce_maintenance()'::regprocedure);
  if definition not like '%public.marketing_automation_runtime where enabled%'
    or definition not like '%enrollment_starts_at<=now()%'
    or definition not like '%public.email_logs%'
    or definition not like '%public.paid_order_admin_outbox%'
    or definition not like '%public.commerce_outbox%'
    or definition not like '%public.funnel_runs%'
    or definition not like '%https://imperioes.com/api/commerce-maintenance%'
    or definition not like '%imperio_commerce_job_secret%'
    then raise exception 'Incomplete scheduler conditions'; end if;
  if has_function_privilege('anon','private.dispatch_commerce_maintenance()','EXECUTE')
    or has_function_privilege('authenticated','private.dispatch_commerce_maintenance()','EXECUTE')
    then raise exception 'Public maintenance dispatch'; end if;
end $$;
rollback;
select true as verified;
