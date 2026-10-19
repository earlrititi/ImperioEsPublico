-- Target a single durable job without claiming unrelated customers' mail.
create function public.claim_commerce_mail_by_id(p_id uuid) returns setof public.commerce_outbox
language plpgsql security definer set search_path='' as $$
declare j public.commerce_outbox;
begin
  select * into j from public.commerce_outbox where id=p_id for update skip locked;
  if not found then return; end if;
  if j.status in ('PENDING','PROCESSING') and j.first_attempt_at < now()-interval '23 hours' then
    update public.commerce_outbox set status='REVIEW' where id=p_id;
    return;
  end if;
  if j.status<>'PENDING' and not coalesce(j.status='PROCESSING' and j.claimed_at<now()-interval '5 minutes',false) then
    return;
  end if;
  return query update public.commerce_outbox set status='PROCESSING',claim_id=gen_random_uuid(),claimed_at=now(),
    first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1 where id=p_id returning *;
end $$;
revoke all on function public.claim_commerce_mail_by_id(uuid) from public,anon,authenticated;
grant execute on function public.claim_commerce_mail_by_id(uuid) to service_role;
