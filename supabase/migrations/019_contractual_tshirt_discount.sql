-- A paid-plan benefit does not imply consent to promotional email.
alter table public.marketing_leads
  alter column marketing_accepted_at drop not null,
  alter column marketing_accepted_at drop default,
  alter column marketing_version drop not null;
