import { SITE } from "../config/site";
import { database, optionalEnv, rpc } from "./reservations";
import { getRequiredEnv } from "./env";
import { renderAdminMail } from "./admin-mail-template";
import { unsubscribeToken } from "./admin-mail";
import { personalizeAutomation, campaignAutomationMail, type AutomationDraft, type WelcomeEligibility } from "./email-automations";
import { nextContactWelcome } from "./contact-welcome-plan";
import { assertMailRecipient } from "./mail-delivery";
import { createCorporateMailClient, sendCorporateMail } from "./customer-mail-service";
import { beginCommercialSend, completeCommercialSend, failCommercialSend, type CommercialReservation } from "./commercial-mail-coordinator";

export async function runContactWelcome(
  approved: { runtime: any; drafts: AutomationDraft[]; digest: string; mode: string },
  limit: number,
  stillApproved: () => Promise<boolean>,
) {
  if (optionalEnv("MARKETING_CENTRAL_WELCOME_ENABLED") !== "true") return { queued: 0, sent: 0, suppressed: 0, failed: 0 };
  const db = await database(), draft = approved.drafts.find(item => item.key === "welcome");
  if (!draft) return { queued: 0, sent: 0, suppressed: 0, failed: 0 };
  const read = async (email: string) => {
    const result = await db.from("marketing_email_contacts").select("*").eq("email", email)
      .gte("marketing_accepted_at", approved.runtime.enrollment_starts_at).maybeSingle();
    if (result.error) throw Error("DATABASE_UNAVAILABLE");
    return result.data;
  };
  const history = async (email: string) => {
    const rows = await rpc("commercial_automation_history", { p_email: email.trim().toLowerCase() });
    if (!Array.isArray(rows) || rows.length > 1000) throw Error("DATABASE_UNAVAILABLE");
    return rows.filter(row => row.key === "welcome") as { step: string; sent_at: string }[];
  };
  const financialFacts = async (email: string): Promise<WelcomeEligibility> => {
    const state = await rpc("commercial_contact_state", { p_email: email });
    if (!state || typeof state.billing_record !== "boolean" || typeof state.payment_in_progress !== "boolean" ||
      typeof state.active_subscription !== "boolean" || (state.paid_at !== null && !Number.isFinite(Date.parse(state.paid_at))))
      throw Error("DATABASE_UNAVAILABLE");
    return { paidAt: state.paid_at === null ? null : Date.parse(state.paid_at), billingRecord: state.billing_record,
      paymentInProgress: state.payment_in_progress, activeSubscription: state.active_subscription };
  };
  const nextFor = async (contact: any) => nextContactWelcome(draft.steps, contact.welcome_at,
    await history(contact.email), Date.now(), await financialFacts(contact.email));
  let query = db.from("marketing_email_contacts").select("*").gte("marketing_accepted_at", approved.runtime.enrollment_starts_at)
    .order("email").limit(100);
  if (approved.runtime.last_contact_email) query = query.gt("email", approved.runtime.last_contact_email);
  const candidates = await query;
  if (candidates.error) throw Error("DATABASE_UNAVAILABLE");
  let queued = 0, sent = 0, suppressed = 0, failed = 0;
  for (const contact of candidates.data) {
    const next = await nextFor(contact);
    if (next && await rpc("queue_contact_welcome", { p_email: contact.email, p_step: next.step.id, p_due: next.due,
      p_revision: draft.revision, p_digest: approved.digest })) queued++;
  }
  const cursor = await db.from("marketing_automation_runtime").update({
    last_contact_email: candidates.data.length === 100 ? candidates.data.at(-1)!.email : null,
  }).eq("id", true);
  if (cursor.error) throw Error("DATABASE_UNAVAILABLE");
  const client = createCorporateMailClient(getRequiredEnv("RESEND_API_KEY"));
  for (let n = 0; n < Math.max(0, Math.min(10, limit)); n++) {
    if (!await stillApproved()) break;
    const job = (await rpc("claim_contact_welcome"))?.[0];
    if (!job) break;
    const finish = async (values: Record<string, unknown>) => {
      const result = await db.from("marketing_automation_jobs").update(values).eq("id", job.id)
        .eq("claim_id", job.claim_id).eq("status", "processing").select("id");
      if (result.error || result.data?.length !== 1) throw Error("EMAIL_RECEIPT_UNAVAILABLE");
    };
    let reservation: CommercialReservation | undefined;
    try {
      const contact = await read(job.contact_email), next = contact ? await nextFor(contact) : null;
      if (!contact || !next || contact.consent_id !== job.consent_id || next.step.id !== job.step ||
        Date.parse(contact.welcome_at) !== Date.parse(job.anchor) || job.revision !== draft.revision || job.template_digest !== approved.digest) {
        await finish({ status: "suppressed", reason: "NO_LONGER_ELIGIBLE", provider_payload: null });
        suppressed++; continue;
      }
      const recipient = approved.mode === "test" ? getRequiredEnv("COMMERCE_TEST_EMAIL") : contact.email;
      let payload = job.provider_payload;
      if (!payload) {
        const mail = campaignAutomationMail(personalizeAutomation(next.step.mail, contact.name), "welcome", job.step);
        const unsubscribe = `${SITE.url}/comunicaciones/baja?token=${unsubscribeToken(contact.email)}`;
        payload = { from: `Imperio Español <${SITE.contactEmail}>`, replyTo: SITE.contactEmail, to: recipient,
          subject: mail.subject, ...renderAdminMail(mail, unsubscribe, true), headers: { "List-Unsubscribe": `<${unsubscribe}>` } };
        const saved = await db.from("marketing_automation_jobs").update({ provider_payload: payload }).eq("id", job.id)
          .eq("claim_id", job.claim_id).eq("status", "processing").is("provider_payload", null).select("id");
        if (saved.error || saved.data?.length !== 1) throw Error("EMAIL_SNAPSHOT_UNAVAILABLE");
      }
      const latest = await read(contact.email), latestNext = latest ? await nextFor(latest) : null;
      const lease = await db.from("marketing_automation_jobs").select("status,claim_id").eq("id", job.id).single();
      if (lease.error) throw Error("DATABASE_UNAVAILABLE");
      if (!latest || !latestNext || latest.consent_id !== job.consent_id || latestNext.step.id !== job.step ||
        Date.parse(latest.welcome_at) !== Date.parse(job.anchor) || lease.data.status !== "processing" ||
        lease.data.claim_id !== job.claim_id || !await stillApproved()) {
        if (lease.data.status === "processing") await finish({ status: "suppressed", reason: "ELIGIBILITY_CHANGED", provider_payload: null });
        suppressed++; continue;
      }
      assertMailRecipient(payload, approved.mode, recipient);
      if (payload.to !== recipient || payload.cc || payload.bcc) throw Error("EMAIL_RECIPIENT_CHANGED");
      reservation = await beginCommercialSend({ source: "automation", jobId: job.id, claimId: job.claim_id, payload });
      if (["deferred", "suppressed", "review"].includes(reservation.action)) {
        if (reservation.action === "suppressed") suppressed++;
        continue;
      }
      if (reservation.action === "accepted") {
        await finish({ status: "sent", provider_id: reservation.providerId, sent_at: new Date().toISOString(),
          provider_payload: null, delivery_status: "accepted_by_provider" });
        sent++; continue;
      }
      const response = await sendCorporateMail(client, payload, { idempotencyKey: `automation-${job.id}` },
        { preserveSnapshot: Boolean(job.provider_payload), audit: false });
      if (response.error || !response.data) throw Error("EMAIL_PROVIDER_UNAVAILABLE");
      await completeCommercialSend(reservation, response.data.id);
      reservation = undefined;
      await finish({ status: "sent", provider_id: response.data.id, sent_at: new Date().toISOString(),
        provider_payload: null, delivery_status: "accepted_by_provider" });
      sent++;
    } catch {
      if (reservation?.action === "send") await failCommercialSend(reservation).catch(() => undefined);
      failed++;
    }
  }
  return { queued, sent, suppressed, failed };
}
