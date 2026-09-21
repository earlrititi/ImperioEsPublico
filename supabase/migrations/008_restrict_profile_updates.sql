revoke update on table public.profiles from authenticated;
grant update (full_name) on table public.profiles to authenticated;

comment on table public.profiles is
'Authenticated users may read their own row and update only full_name; privileged changes remain server-only.';
