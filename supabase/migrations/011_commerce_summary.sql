create function public.commerce_summary() returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'reservations',(select count(*) from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED')),
    'reservedUnits',(select coalesce(sum(total_quantity),0) from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED')),
    'potentialValue',(select coalesce(sum(total_price_snapshot),0) from public.reservations where status in ('RESERVED','PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED')),
    'paidOrders',(select count(*) from public.commerce_orders),
    'paidUnits',(select coalesce(sum(total_quantity),0) from public.commerce_orders),
    'collectedRevenue',(select coalesce(sum(total-refunded_amount),0) from public.commerce_orders),
    'pendingEmails',(select count(*) from public.commerce_outbox where status <> 'SENT'),
    'reviewEmails',(select count(*) from public.commerce_outbox where status = 'REVIEW')
  );
$$;
revoke all on function public.commerce_summary() from public,anon,authenticated;
grant execute on function public.commerce_summary() to service_role;
