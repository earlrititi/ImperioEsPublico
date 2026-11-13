-- Wake the existing maintenance dispatcher when Stripe mail needs a retry.
-- Preserve its endpoint, authentication, other predicates, owner and grants.
-- This neither enables the runtime nor enrolls/sends historical notifications.
begin;

do $migration$
declare
  dispatcher regprocedure := to_regprocedure('private.dispatch_commerce_maintenance()');
  definition text;
  anchor text := '    then return null; end if;';
  addition text := $predicate$    and not exists(
      select 1 from public.stripe_customer_mail_outbox j
      cross join public.stripe_customer_mail_runtime r
      where r.id=true and r.enabled and r.starts_at is not null and r.starts_at<=now()
        and ((j.status in ('pending','failed') and j.next_attempt_at<=now())
          or (j.status='processing' and j.claimed_at<now()-interval '5 minutes')))
$predicate$;
begin
  if dispatcher is null then raise exception 'STRIPE_MAIL_DISPATCHER_MISSING'; end if;
  select pg_get_functiondef(dispatcher) into definition;
  if strpos(definition,addition)>0 then return; end if;
  if strpos(definition,'stripe_customer_mail_outbox')>0
    or (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
    raise exception 'STRIPE_MAIL_DISPATCHER_UNEXPECTED';
  end if;
  execute replace(definition,anchor,addition||anchor);
end
$migration$;

commit;
