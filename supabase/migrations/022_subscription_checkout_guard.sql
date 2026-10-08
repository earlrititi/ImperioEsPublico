-- A single payable checkout per normalized email, shared across tabs and users.
create table public.subscription_checkouts (
  email text primary key check (email=lower(btrim(email))),
  attempt_id uuid not null default gen_random_uuid(),
  plan text not null,
  user_id uuid references auth.users(id),
  parameters jsonb not null,
  stripe_session_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.subscription_checkouts enable row level security;
revoke all on public.subscription_checkouts from anon, authenticated;
grant all on public.subscription_checkouts to service_role;

create function public.claim_subscription_checkout(p_email text,p_plan text,p_user uuid,p_parameters jsonb)
returns public.subscription_checkouts language plpgsql security definer set search_path='' as $$
declare result public.subscription_checkouts;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 721));
  select * into result from public.subscription_checkouts where email=lower(btrim(p_email)) for update;
  if found and result.expires_at + interval '2 minutes' > now() then
    if result.plan<>p_plan or result.user_id is distinct from p_user then
      raise exception 'CHECKOUT_ALREADY_OPEN';
    end if;
    return result;
  end if;
  insert into public.subscription_checkouts(email,plan,user_id,parameters,expires_at)
  values(lower(btrim(p_email)),p_plan,p_user,
    p_parameters || jsonb_build_object('expires_at',floor(extract(epoch from now()+interval '23 hours'))),
    to_timestamp(floor(extract(epoch from now()+interval '23 hours'))))
  on conflict(email) do update set attempt_id=gen_random_uuid(),plan=excluded.plan,
    user_id=excluded.user_id,parameters=excluded.parameters,stripe_session_id=null,
    expires_at=excluded.expires_at,created_at=now()
  returning * into result;
  return result;
end;
$$;
revoke all on function public.claim_subscription_checkout(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_subscription_checkout(text,text,uuid,jsonb) to service_role;
