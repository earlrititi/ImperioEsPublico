alter table public.reservations add column marketing_withdrawn_at timestamptz;
drop function public.begin_shirt_payment(uuid,jsonb,text);
create function public.begin_shirt_payment(p_id uuid,p_address jsonb,p_terms text,p_customer jsonb default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.reservations; a public.reservation_payment_attempts; aid uuid; cname text; email text;
begin
  if not private.valid_mainland_address(p_address) then raise exception 'INVALID_MAINLAND_ADDRESS'; end if;
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('PURCHASE_AVAILABLE','PAYMENT_PENDING','PAYMENT_FAILED') then raise exception 'INVALID_STATE'; end if;
  if r.expires_at<=now() then raise exception 'RESERVATION_EXPIRED'; end if;
  cname:=case when p_customer is null then r.customer_name else trim(p_customer->>'name') end;
  email:=case when p_customer is null then r.customer_email else lower(trim(p_customer->>'email')) end;
  if coalesce(length(cname),0) not between 2 and 150 or coalesce(email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(email)>254 then raise exception 'INVALID_CUSTOMER'; end if;
  select * into a from public.reservation_payment_attempts where reservation_id=p_id and status='OPEN';
  if found then
    if a.shipping_address<>p_address or r.customer_name<>cname or r.customer_email<>email then raise exception 'PAYMENT_ADDRESS_LOCKED'; end if;
    return a.id;
  end if;
  update public.reservations set status='PAYMENT_PENDING',shipping_address=p_address,customer_name=cname,customer_email=email where id=p_id;
  insert into public.reservation_payment_attempts(reservation_id,shipping_address,terms_version) values(p_id,p_address,p_terms) returning id into aid;
  return aid;
end $$;
revoke all on function public.begin_shirt_payment(uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.begin_shirt_payment(uuid,jsonb,text,jsonb) to service_role;
