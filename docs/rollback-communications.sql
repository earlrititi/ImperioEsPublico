-- Review and apply only to the intended Test environment after stopping mailbox jobs.
-- Existing queues/consents/orders and newly imported private mailbox rows are preserved.
begin;
drop view if exists public.admin_audience_totals;
drop view if exists public.admin_audience_contacts;
drop view if exists public.admin_audience_sources;
drop view if exists public.admin_audience_timeline;
drop view if exists public.admin_communication_coverage;
drop view if exists public.admin_communication_records;
drop view if exists public.admin_communication_source_records;
drop function if exists public.commit_mailbox_read_batch(jsonb);
drop function if exists public.prune_communications_data();
drop function if exists public.admin_verified_mail_state(text,text,timestamptz,timestamptz);
drop function if exists public.admin_mail_state(text,text,timestamptz);
-- Provider confirmation provenance columns are retained; no mail history is erased.
-- RLS and service-only grants on communication_* tables remain in place.
commit;
