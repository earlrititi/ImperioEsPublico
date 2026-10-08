import { SITE } from "../config/site";
import { getRequiredEnv } from "./env";
import { database, hash, optionalEnv, rpc, safeEqual, sign } from "./reservations";
import { renderAdminMail, type MailContent } from "./admin-mail-template";

export function mailApproval(actor: string, payload: unknown, expires: number) {
  return sign(`admin-mail:${actor}:${expires}:${hash(JSON.stringify(payload))}`);
}
export function verifyMailApproval(actor: string, payload: unknown, expires: unknown, token: unknown) {
  return typeof expires === "number" && expires > Date.now() && expires < Date.now() + 16 * 60 * 1000 &&
    typeof token === "string" && /^[a-f0-9]{64}$/.test(token) && safeEqual(mailApproval(actor,payload,expires),token);
}
export function unsubscribeToken(email: string) {
  const encoded = Buffer.from(email).toString("base64url");
  return `${encoded}.${sign(`unsubscribe:${encoded}`)}`;
}
export function readUnsubscribeToken(token: string) {
  const [encoded, signature, extra] = token.split(".");
  if (extra || !encoded || !signature || encoded.length > 400 || !/^[a-f0-9]{64}$/.test(signature) || !safeEqual(signature,sign(`unsubscribe:${encoded}`))) throw new Error("INVALID_INPUT");
  const email = Buffer.from(encoded,"base64url").toString("utf8");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_INPUT");
  return email;
}

export async function isMailSuppressed(db: Awaited<ReturnType<typeof database>>, email: string) {
  const recipient = email.trim().toLowerCase();
  const emailPattern = recipient.replace(/[\\%_]/g,"\\$&");
  const suppression = await db.from("email_suppressions").select("email").eq("email",recipient).limit(1);
  if (suppression.error) throw new Error("SUPPRESSION_LOOKUP_FAILED");
  if (suppression.data?.length) return true;
  const reservation = await db.from("reservations").select("id").ilike("customer_email",emailPattern)
    .not("marketing_withdrawn_at","is",null).limit(1);
  if (reservation.error) throw new Error("SUPPRESSION_LOOKUP_FAILED");
  if (reservation.data?.length) return true;
  const profiles = await db.from("profiles").select("id").ilike("email",emailPattern);
  if (profiles.error) throw new Error("SUPPRESSION_LOOKUP_FAILED");
  if (!profiles.data?.length) return false;
  const consent = await db.from("legal_consents").select("id").in("user_id",profiles.data.map(p=>p.id))
    .eq("consent_type","marketing_email").not("withdrawn_at","is",null).limit(1);
  if (consent.error) throw new Error("SUPPRESSION_LOOKUP_FAILED");
  return Boolean(consent.data?.length);
}

export async function drainAdminMail(limit = 10) {
  const mode = optionalEnv("COMMERCE_EMAIL_MODE");
  if (!["live","test"].includes(mode)) return { sent:0, disabled:true };
  const { Resend } = await import("resend");
  const client = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const db = await database();
  let sent = 0;
  for (let n=0;n<Math.min(limit,20);n++) {
    const job = (await rpc("claim_admin_mail"))?.[0];
    if (!job) break;
    try {
      if (job.type !== "test" && await isMailSuppressed(db,job.recipient)) {
        await rpc("finish_admin_mail",{p_id:job.id,p_claim:job.claim_id,p_status:"suppressed"}); continue;
      }
      let payload = job.provider_payload;
      if (!payload) {
        const recipient = mode === "test" ? getRequiredEnv("COMMERCE_TEST_EMAIL") : job.recipient;
        const unsubscribe = `${getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/,"")}/comunicaciones/baja?token=${unsubscribeToken(job.recipient)}`;
        payload = {from:`Imperio E <${SITE.contactEmail}>`,replyTo:SITE.contactEmail,to:recipient,subject:job.subject,
          ...renderAdminMail(job as MailContent,job.type === "test" ? undefined : unsubscribe)};
        const saved = await db.from("email_logs").update({provider_payload:payload}).eq("id",job.id).eq("claim_id",job.claim_id).is("provider_payload",null).select("id");
        if (saved.error || saved.data?.length !== 1) throw new Error("EMAIL_SNAPSHOT_UNAVAILABLE");
      }
      const result = await client.emails.send(payload,{idempotencyKey:`admin-mail-${job.id}`});
      if (result.error || !result.data) throw new Error("EMAIL_PROVIDER_UNAVAILABLE");
      await rpc("finish_admin_mail",{p_id:job.id,p_claim:job.claim_id,p_status:"sent",p_provider_id:result.data.id});
      sent++;
    } catch {
      await rpc("finish_admin_mail",{p_id:job.id,p_claim:job.claim_id,p_status:"failed",p_error:"Delivery attempt failed; retry uses the same provider key"});
    }
    await new Promise(resolve=>{ setTimeout(resolve,600); });
  }
  return {sent,disabled:false};
}
