alter table public.marketing_automation_runtime add column enrollment_starts_at timestamptz;

-- Enrollment is prospective. Existing accounts never become a retrospective
-- welcome audience merely because the operator enables the worker.
create view public.marketing_automation_enrolled_subjects with(security_barrier=true) as
select s.* from public.marketing_automation_subjects s
join auth.users u on u.id=s.user_id
cross join public.marketing_automation_runtime r
where r.enabled and r.enrollment_starts_at is not null and r.enrollment_starts_at<=now()
  and u.created_at>=r.enrollment_starts_at;
revoke all on public.marketing_automation_enrolled_subjects from public,anon,authenticated;
grant select on public.marketing_automation_enrolled_subjects to service_role;

create or replace function public.queue_marketing_automation(p_user uuid,p_consent uuid,p_key text,p_step text,p_anchor timestamptz,p_due timestamptz,p_revision integer,p_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('marketing-user:'||p_user,0));
  if not exists(select 1 from public.marketing_automation_runtime where enabled and template_digest=p_digest)
    or p_anchor>now() or p_anchor<now()-interval '14 days' or p_due>now() or p_due<p_anchor then return null;end if;
  if not exists(select 1 from public.marketing_automation_enrolled_subjects where user_id=p_user and consent_id=p_consent and paid_at is null and not billing_record and not payment_in_progress)
    or exists(select 1 from public.marketing_automation_jobs where user_id=p_user and (status in ('pending','processing') or sent_at>now()-interval '6 hours')) then return null;end if;
  insert into public.marketing_automation_jobs(user_id,consent_id,key,step,anchor,due_at,revision,template_digest)
    values(p_user,p_consent,p_key,p_step,p_anchor,p_due,p_revision,p_digest) on conflict do nothing returning id into target;
  return target;
end $$;
revoke all on function public.queue_marketing_automation(uuid,uuid,text,text,timestamptz,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.queue_marketing_automation(uuid,uuid,text,text,timestamptz,timestamptz,integer,text) to service_role;
