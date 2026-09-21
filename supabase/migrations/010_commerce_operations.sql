create function public.update_commerce_fulfillment(p_id uuid, p_status text, p_carrier text, p_tracking text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.commerce_orders;
begin
  select * into o from public.commerce_orders where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not ((o.status='READY_FOR_FULFILLMENT' and p_status='PREPARING') or (o.status='PREPARING' and p_status='READY_TO_SHIP')
    or (o.status='READY_TO_SHIP' and p_status='SHIPPED') or (o.status='SHIPPED' and p_status='DELIVERED')) then raise exception 'INVALID_STATE'; end if;
  if p_status='SHIPPED' and (coalesce(length(trim(p_carrier)),0) < 2 or coalesce(length(trim(p_tracking)),0) < 2) then raise exception 'TRACKING_REQUIRED'; end if;
  update public.commerce_orders set status=p_status,carrier=coalesce(nullif(p_carrier,''),carrier),tracking_number=coalesce(nullif(p_tracking,''),tracking_number),
    shipped_at=case when p_status='SHIPPED' then now() else shipped_at end where id=p_id;
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,p_id,p_status);
end $$;
create function public.record_commerce_refund(p_intent text, p_refunded integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.commerce_orders set refunded_amount=p_refunded,status=case when p_refunded=total then 'REFUNDED' else status end
    where stripe_payment_intent_id=p_intent and refunded_amount < p_refunded;
  -- A financial refund does not prove a physical return; never restock automatically.
end $$;
revoke all on function public.update_commerce_fulfillment(uuid,text,text,text,uuid), public.record_commerce_refund(text,integer) from public,anon,authenticated;
grant execute on function public.update_commerce_fulfillment(uuid,text,text,text,uuid), public.record_commerce_refund(text,integer) to service_role;
