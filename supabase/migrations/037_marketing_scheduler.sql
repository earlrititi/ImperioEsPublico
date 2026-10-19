-- Keep the existing job, destination and Vault secret. Marketing must not depend
-- on an unrelated order appearing in the transactional queues.
create or replace function private.dispatch_commerce_maintenance() returns bigint
language plpgsql security definer set search_path='' as $$
declare request_id bigint; secret text;
begin
  delete from public.funnel_runs where created_at<now()-interval '90 days';
  if not exists(select 1 from public.paid_order_admin_outbox where status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
    and not exists(select 1 from public.paid_order_admin_outbox where status='SENT' and sent_at>now()-interval '7 days'
      and (provider_checked_at is null or (provider_checked_at<now()-interval '1 hour' and delivery_status not in ('delivered','bounced','complained','failed','canceled','suppressed'))))
    and not exists(select 1 from public.commerce_outbox where status='PENDING' or (status='PROCESSING' and claimed_at<now()-interval '5 minutes'))
    and not exists(select 1 from public.email_logs where status='pending' or (status in ('processing','failed') and claimed_at<now()-interval '5 minutes')
      or (status='sent' and sent_at>now()-interval '7 days' and (provider_checked_at is null or provider_checked_at<now()-interval '6 hours')))
    and not exists(select 1 from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_FAILED','PAYMENT_PENDING') and expires_at<=now())
    and not exists(select 1 from public.commerce_campaign c where c.purchase_activated and (c.purchase_open_at is null or c.purchase_open_at<=now())
      and exists(select 1 from public.reservations where status='RESERVED'))
    and not exists(select 1 from public.marketing_automation_runtime where enabled and enrollment_starts_at is not null and enrollment_starts_at<=now())
    then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='imperio_commerce_job_secret';
  if secret is null then raise exception 'MAINTENANCE_SECRET_MISSING'; end if;
  select net.http_post(url:='https://imperioes.com/api/commerce-maintenance',
    headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),
    body:='{}'::jsonb,timeout_milliseconds:=30000) into request_id;
  return request_id;
end $$;
revoke all on function private.dispatch_commerce_maintenance() from public,anon,authenticated;
