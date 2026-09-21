create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists stripe_webhook_events_status_received_idx
on public.stripe_webhook_events(status, received_at);

grant select, insert, update, delete on table public.stripe_webhook_events to service_role;
alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
'Server-only idempotency ledger for verified Stripe webhook events.';
