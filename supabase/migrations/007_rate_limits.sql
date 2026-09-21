create table if not exists private.request_rate_limits (
  endpoint text not null,
  bucket_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  primary key (endpoint, bucket_key)
);

create or replace function public.consume_rate_limit(
  p_endpoint text,
  p_bucket_key text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = private, public
as $$
declare
  current_count integer;
begin
  if p_window_seconds < 1 or p_limit < 1 then
    return false;
  end if;

  insert into private.request_rate_limits (
    endpoint,
    bucket_key,
    window_started_at,
    request_count
  )
  values (p_endpoint, p_bucket_key, now(), 1)
  on conflict (endpoint, bucket_key)
  do update set
    window_started_at = case
      when private.request_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then now()
      else private.request_rate_limits.window_started_at
    end,
    request_count = case
      when private.request_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then 1
      else private.request_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke execute on function public.consume_rate_limit(text, text, integer, integer) from anon;
revoke execute on function public.consume_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

comment on function public.consume_rate_limit(text, text, integer, integer) is
'Atomic server-only fixed-window rate limiter. Bucket keys must be pseudonymised before use.';
