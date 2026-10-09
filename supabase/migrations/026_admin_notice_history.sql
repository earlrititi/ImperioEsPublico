create table public.admin_notification_history (
  id text primary key,
  kind text not null check(kind in ('registration','checkout_interest','manifesto','paid_subscription')),
  customer_email text not null,
  subject text not null,
  occurred_at timestamptz not null default now(),
  source text not null check(source in ('gmail','application')),
  delivery_status text not null,
  source_url text,
  created_at timestamptz not null default now()
);
alter table public.admin_notification_history enable row level security;
revoke all on public.admin_notification_history from anon,authenticated;
grant all on public.admin_notification_history to service_role;
