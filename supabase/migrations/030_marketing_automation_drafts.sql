-- Draft configuration only. This migration cannot enrol recipients or send mail.
create table public.marketing_automation_drafts (
  id uuid not null unique default gen_random_uuid(),
  key text primary key check (key in ('welcome','checkout','viewed_product','site','cart')),
  steps jsonb not null check (jsonb_typeof(steps)='array' and jsonb_array_length(steps) between 1 and 5),
  revision integer not null default 1 check (revision>0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.marketing_automation_drafts enable row level security;
revoke all on public.marketing_automation_drafts from public,anon,authenticated;
grant select,insert,update on public.marketing_automation_drafts to service_role;

create function public.save_marketing_automation_draft(p_key text,p_actor uuid,p_revision integer,p_steps jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare current_revision integer;next_revision integer;target_id uuid;
begin
  if p_key not in ('welcome','checkout','viewed_product','site','cart') or p_revision<0 then raise exception 'INVALID_INPUT';end if;
  perform pg_advisory_xact_lock(hashtextextended('automation:'||p_key,0));
  select revision into current_revision from public.marketing_automation_drafts where key=p_key for update;
  if coalesce(current_revision,0)<>p_revision then raise exception 'REQUEST_CONFLICT';end if;
  next_revision:=p_revision+1;
  insert into public.marketing_automation_drafts(key,steps,revision,updated_by)
    values(p_key,p_steps,next_revision,p_actor)
    on conflict(key) do update set steps=excluded.steps,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
    returning id into target_id;
  insert into public.commerce_audit(actor_id,entity_id,entity,action)
    values(p_actor,target_id,'email_automation','AUTOMATION_DRAFT_SAVED:'||p_key||':'||next_revision);
  return next_revision;
end $$;
revoke all on function public.save_marketing_automation_draft(text,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_marketing_automation_draft(text,uuid,integer,jsonb) to service_role;
