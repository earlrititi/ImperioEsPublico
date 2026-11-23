-- PREPARED ONLY. Do not execute until the reviewed code is deployed and the
-- production MARKETING_AUTOMATION_SCOPE is explicitly set to recovery.
-- Exact reviewed texts: tmp/recovery-repair/recovery-review.json.
-- Preserve the existing enrollment cutoff: only recovery activity occurring
-- at/after this new approval qualifies; existing identities are not excluded.
begin;

do $recovery_approval$
declare
  previous public.marketing_automation_runtime%rowtype;
begin
  select * into strict previous from public.marketing_automation_runtime where id=true for update;
  if not previous.enabled
    or previous.template_digest <> 'e30443cd4e282263ddb97240d81f74558affdc702d6d0ad0414a308a43dd225c'
    or previous.approved_at is distinct from '2026-10-19T12:06:50.881655+00:00'::timestamptz
    or previous.enrollment_starts_at is distinct from '2026-10-19T12:06:50.881655+00:00'::timestamptz
    or previous.approved_by is null then
    raise exception 'RECOVERY_APPROVAL_STATE_CHANGED';
  end if;
  if exists(select 1 from public.marketing_automation_drafts) then
    raise exception 'RECOVERY_REVIEWED_DRAFTS_CHANGED';
  end if;
  if not exists(select 1 from public.commerce_orders o where o.id=previous.purchase_proof_id
    and o.total>0 and o.status not in ('CANCELLED','REFUNDED')
    and left(o.stripe_checkout_session_id,8)='cs_live_') then
    raise exception 'RECOVERY_PURCHASE_PROOF_UNAVAILABLE';
  end if;
  update public.marketing_automation_runtime
  set template_digest='ed8b5018b362201606e937355c81cfea504a575e6e3730dc115966f54d7e6be4',
      approved_at=clock_timestamp(), last_user_id=null
  where id=true;
end
$recovery_approval$;

select jsonb_build_object('enabled',enabled,'approved_at',approved_at,
  'enrollment_starts_at',enrollment_starts_at,'template_digest',template_digest)
from public.marketing_automation_runtime where id=true;
commit;
