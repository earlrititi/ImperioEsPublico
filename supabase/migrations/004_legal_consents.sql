create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  consent_type text not null check (
    consent_type in (
      'terms',
      'privacy_acknowledgement',
      'marketing_email',
      'cookies_preferences',
      'cookies_analytics',
      'cookies_marketing',
      'digital_content_immediate_access',
      'digital_withdrawal_acknowledgement'
    )
  ),
  document_version text not null,
  accepted boolean not null,
  source text not null,
  context_type text,
  context_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint legal_consents_subject_check check (
    user_id is not null or anonymous_id is not null
  )
);

create index if not exists legal_consents_user_created_idx
on public.legal_consents(user_id, created_at desc)
where user_id is not null;

create index if not exists legal_consents_anonymous_created_idx
on public.legal_consents(anonymous_id, created_at desc)
where anonymous_id is not null;

create index if not exists legal_consents_type_created_idx
on public.legal_consents(consent_type, created_at desc);

create index if not exists legal_consents_context_idx
on public.legal_consents(context_type, context_id)
where context_id is not null;

grant select on table public.legal_consents to authenticated;
grant select, insert, update, delete on table public.legal_consents to service_role;

alter table public.legal_consents enable row level security;

drop policy if exists "Users can read own legal consents" on public.legal_consents;
create policy "Users can read own legal consents"
on public.legal_consents
for select
to authenticated
using (auth.uid() = user_id);

comment on table public.legal_consents is
'Append-only evidence of legal choices. Browser writes are handled by trusted server endpoints.';
