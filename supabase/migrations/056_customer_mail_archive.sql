begin;

-- Prospective, inert copies only. Existing records and dispatch claims are retained.
-- No backfill, Auth foreign key, transport payload, header or attachment is stored.
alter table public.customer_mail_deliveries add column body_html text;
alter table public.customer_mail_deliveries add column body_text text;

-- Auth hooks retain a generic notice, never their bearer links or OTP payload.
create or replace function public.complete_customer_mail(p_id uuid,p_claim uuid,p_provider text) returns boolean
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if p_provider is null or length(trim(p_provider))=0 then raise exception 'CUSTOMER_MAIL_PROVIDER_REQUIRED';end if;
  update public.customer_mail_deliveries set status='sent',provider_id=p_provider,delivery_status='accepted_by_provider',
    sent_at=clock_timestamp(),claim_id=null,claimed_at=null,error=null,
    body_html=case when flow='supabase_auth' then '<p>Aviso de seguridad enviado. El contenido, los enlaces de acceso y los códigos se omiten en esta copia de consulta.</p>' else body_html end,
    body_text=case when flow='supabase_auth' then 'Aviso de seguridad enviado. El contenido, los enlaces de acceso y los códigos se omiten en esta copia de consulta.' else body_text end
    where id=p_id and claim_id=p_claim and status='processing';
  get diagnostics changed=row_count;
  return changed=1;
end $$;

-- Preserve the view OID, its grants and all dependent views.
create or replace view public.admin_communication_source_records with(security_barrier=true) as
select * from public.admin_communication_legacy_source_records
union all
select 'customer_mail_deliveries:'||m.id,'customer_mail_deliveries',m.id::text,'outbound',
 m.created_at,coalesce(m.sent_at,m.created_at),m.sent_at,m.provider_checked_at,
 m.sender,m.recipient,''::text,m.subject,'transaccional',m.flow,m.stage,m.status,
 public.admin_verified_mail_state(m.status,m.delivery_status,m.provider_delivery_confirmed_at),m.delivery_status,
 'resend',m.provider_id,null::text,m.attempts,m.error,m.body_html,m.body_text,null::text,null::text,null::boolean
from public.customer_mail_deliveries m;

revoke all on function public.complete_customer_mail(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_customer_mail(uuid,uuid,text) to service_role;

commit;
