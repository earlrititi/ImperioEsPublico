alter table public.commerce_outbox add column encrypted_message text;

create function public.admin_commerce_action(p_id uuid,p_action text,p_actor uuid,p_request uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_action='cancel' then perform public.release_shirt_reservation(p_id,'CANCELLED');
  elsif p_action='open' then perform public.open_shirt_purchase(p_id);
  elsif p_action='resend' and p_request is not null then
    insert into public.commerce_outbox(reservation_id,kind,version) values(p_id,'RESHIP_EMAIL',p_request) on conflict do nothing;
  else raise exception 'INVALID_ACTION'; end if;
  insert into public.commerce_audit(actor_id,entity_id,action) values(p_actor,p_id,p_action);
end $$;
revoke all on function public.admin_commerce_action(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_commerce_action(uuid,text,uuid,uuid) to service_role;
