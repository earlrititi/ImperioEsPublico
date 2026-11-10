import { randomUUID } from "node:crypto";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { EMAIL_MARKETING_CONSENT, EMAIL_MARKETING_COPY_VERSION } from "../config/email-marketing";
import { SITE } from "../config/site";
import { database, optionalEnv, rpc } from "./reservations";
import { contactTokenHash, contactVerificationToken, normalizedContactEmail } from "./marketing-contact-token";
import { ADMIN_NOTIFICATION_EMAIL } from "./admin-notifications";
import {getRequiredEnv} from "./env";

function marketingTransportReady(){
  const mode=optionalEnv("COMMERCE_EMAIL_MODE");
  if(!["test","live"].includes(mode))return false;
  if(!new RegExp(`^(sk|rk)_${mode}_`).test(getRequiredEnv("STRIPE_SECRET_KEY")))throw Error("BILLING_MODE_MISMATCH");
  return true;
}

/** Resource/checkout success never depends on the commercial verification email. */
export async function requestMarketingVerification(input:{email:string;name?:string;source:string;contextId:string}) {
  if(optionalEnv("MARKETING_CONTACT_VERIFICATION_ENABLED")!=="true"||!marketingTransportReady())return;
  const db=await database(),email=normalizedContactEmail(input.email);
  const blocked=await db.from("marketing_suppressed_contacts").select("email").eq("email",email).limit(1);
  if(blocked.error)throw Error("DATABASE_UNAVAILABLE");
  if(blocked.data.length)return; // A purchase never overrides a previous withdrawal.
  const existing=await db.from("marketing_email_verifications").select("*").eq("email",email).maybeSingle();
  if(existing.error)throw Error("DATABASE_UNAVAILABLE");
  if(existing.data?.verified_at)return;
  const retryExpired=existing.data?.confirmation_first_attempt_at&&Date.parse(existing.data.confirmation_first_attempt_at)<Date.now()-23*3600000;
  const renew=existing.data&&(Date.parse(existing.data.expires_at)<Date.now()||retryExpired)&&existing.data.context_id!==input.contextId;
  if(retryExpired&&!renew)return;
  if(existing.data?.confirmation_sent_at&&!renew)return;
  const secret=optionalEnv("MARKETING_VERIFICATION_SECRET"),id=existing.data?.id??randomUUID();
  const expires=renew||!existing.data?new Date(Date.now()+48*3600000).toISOString():existing.data.expires_at;
  const token=contactVerificationToken(id,expires,secret);
  if(Date.parse(expires)<Date.now())return; // Expired requests require an explicit new request, never silently re-enroll.
  if(!existing.data||renew){
    const proof=await db.from("legal_consents").insert({anonymous_id:id,consent_type:"marketing_email",document_version:LEGAL_DOCUMENT_VERSIONS.privacy,
      accepted:true,source:input.source,context_type:"verified_marketing_request",context_id:input.contextId,
      metadata:{copy_version:EMAIL_MARKETING_COPY_VERSION,consent_text:EMAIL_MARKETING_CONSENT,channel:"email_confirmation"}}).select("id").single();
    if(proof.error)throw Error("DATABASE_UNAVAILABLE");
    const values={id,email,name:(input.name??"").slice(0,150),source:input.source,context_id:input.contextId,consent_id:proof.data.id,
      token_hash:contactTokenHash(token),expires_at:expires,confirmation_provider_id:null,confirmation_sent_at:null,confirmation_first_attempt_at:null,consumed_at:null};
    const saved=renew?await db.from("marketing_email_verifications").update(values).eq("id",id).eq("expires_at",existing.data.expires_at).is("verified_at",null)
      :await db.from("marketing_email_verifications").upsert(values,{onConflict:"email",ignoreDuplicates:true});
    if(saved.error)throw Error("DATABASE_UNAVAILABLE");
    const current=await db.from("marketing_email_verifications").select("id,token_hash").eq("email",email).single();
    if(current.error)throw Error("DATABASE_UNAVAILABLE");
    if(current.data.id!==id||current.data.token_hash!==contactTokenHash(token))return; // Another request owns the persisted proof and link.
  }
  const link=`${SITE.url}/comunicaciones/confirmar#${id}.${token}`;
  const attempted=await db.from("marketing_email_verifications").update({confirmation_first_attempt_at:existing.data?.confirmation_first_attempt_at&&!renew?existing.data.confirmation_first_attempt_at:new Date().toISOString()}).eq("id",id).eq("token_hash",contactTokenHash(token));
  if(attempted.error)throw Error("DATABASE_UNAVAILABLE");
  const {resend}=await import("./resend");
  const recipient=optionalEnv("COMMERCE_EMAIL_MODE")==="test"?optionalEnv("COMMERCE_TEST_EMAIL"):email;
  if(!recipient)throw Error("EMAIL_TEST_RECIPIENT_REQUIRED");
  const result=await resend.emails.send({from:`Imperio Español <${SITE.contactEmail}>`,replyTo:SITE.contactEmail,to:recipient,
    subject:"Confirma tus comunicaciones de Imperio Español",
    html:`<p>Has solicitado recibir historias, novedades y ofertas de Imperio Español.</p><p>Confirma que esta dirección es tuya para activar las comunicaciones:</p><p><a href="${link}">Confirmar mi suscripción</a></p><p>El enlace caduca en 48 horas. Si no lo has solicitado, ignora este correo. Tu cuenta, compra o descarga siguen siendo independientes.</p>`,
    text:`Confirma tus comunicaciones de Imperio Español: ${link}\nEl enlace caduca en 48 horas. Si no lo has solicitado, ignora este correo. Tu cuenta, compra o descarga no dependen de esta confirmación.`},
    {idempotencyKey:`marketing-verification-${id}-${contactTokenHash(token).slice(0,16)}`});
  if(result.error||!result.data)throw Error("EMAIL_PROVIDER_UNAVAILABLE");
  const saved=await db.from("marketing_email_verifications").update({confirmation_provider_id:result.data.id,confirmation_sent_at:new Date().toISOString()}).eq("id",id);
  if(saved.error)throw Error("DATABASE_UNAVAILABLE");
}

export async function runSubscriptionNotices(limit=5) {
  if(optionalEnv("MARKETING_SUBSCRIBER_NOTICES_ENABLED")!=="true"||!marketingTransportReady())return {disabled:true,sent:0};
  const db=await database(),runtime=await db.from("marketing_automation_runtime").select("enrollment_starts_at,last_notice_email").eq("id",true).single();
  if(runtime.error)throw Error("DATABASE_UNAVAILABLE");
  if(!runtime.data.enrollment_starts_at)return {disabled:true,sent:0};
  let candidates=db.from("marketing_email_contacts").select("*").gte("marketing_accepted_at",runtime.data.enrollment_starts_at).order("email").limit(100);
  if(runtime.data.last_notice_email)candidates=candidates.gt("email",runtime.data.last_notice_email);
  const contacts=await candidates;
  if(contacts.error)throw Error("DATABASE_UNAVAILABLE");
  for(const contact of contacts.data){
    const saved=await db.from("marketing_subscription_notices").upsert({email:contact.email,consent_id:contact.consent_id},{onConflict:"email",ignoreDuplicates:true});
    if(saved.error)throw Error("DATABASE_UNAVAILABLE");
  }
  const cursor=await db.from("marketing_automation_runtime").update({last_notice_email:contacts.data.length===100?contacts.data.at(-1)!.email:null}).eq("id",true);
  if(cursor.error)throw Error("DATABASE_UNAVAILABLE");
  let sent=0;
  for(let n=0;n<Math.min(10,limit);n++){
    const job=(await rpc("claim_marketing_subscription_notice"))?.[0];if(!job)break;
    const contact=await db.from("marketing_email_contacts").select("*").eq("email",job.email).eq("consent_id",job.consent_id).maybeSingle();
    if(contact.error)throw Error("DATABASE_UNAVAILABLE");
    if(!contact.data){await db.from("marketing_subscription_notices").update({status:"review"}).eq("email",job.email).eq("claim_id",job.claim_id);continue;}
    try{
      const {resend}=await import("./resend");
      const to=optionalEnv("COMMERCE_EMAIL_MODE")==="test"?optionalEnv("COMMERCE_TEST_EMAIL"):ADMIN_NOTIFICATION_EMAIL;
      if(!to)throw Error("EMAIL_TEST_RECIPIENT_REQUIRED");
      const c=contact.data;
      const text=`Nuevo suscriptor confirmado\n${c.name||"Sin nombre"}\n${c.email}\nOrigen: ${c.source}\nConfirmación: ${c.verified_at}\nCorreo verificado y consentimiento vigente. Welcome Series sujeta a la activación aprobada y a su cola, sin duplicados.`;
      const result=await resend.emails.send({from:`Imperio Español <${SITE.contactEmail}>`,to,replyTo:SITE.contactEmail,
        subject:"IMPERIO E | Nuevo suscriptor confirmado",text,html:`<p>${text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\n","<br>")}</p>`},
        {idempotencyKey:`subscriber-notice-${job.consent_id}`});
      if(result.error||!result.data)throw Error("EMAIL_PROVIDER_UNAVAILABLE");
      const saved=await db.from("marketing_subscription_notices").update({status:"sent",provider_id:result.data.id,sent_at:new Date().toISOString()}).eq("email",job.email).eq("claim_id",job.claim_id);
      if(saved.error)throw Error("DATABASE_UNAVAILABLE");sent++;
    }catch{
      const saved=await db.from("marketing_subscription_notices").update({status:"pending",next_attempt_at:new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString()}).eq("email",job.email).eq("claim_id",job.claim_id);
      if(saved.error)throw Error("DATABASE_UNAVAILABLE");
    }
  }
  return {disabled:false,sent};
}
