-- Consent evidence is written by trusted server endpoints, never by browser roles.
revoke all on public.legal_consents from public,anon,authenticated;
grant select on public.legal_consents to authenticated;
grant select,insert,update,delete on public.legal_consents to service_role;
