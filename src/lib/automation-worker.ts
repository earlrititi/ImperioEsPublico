import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { SITE } from "../config/site";
import { getRequiredEnv } from "./env";
import { database, hash, optionalEnv, rpc } from "./reservations";
import { AUTOMATION_DEFAULTS, campaignAutomationMail, personalizeAutomation, planAutomation, validateAutomationDraft, type AutomationFacts, type AutomationSent } from "./email-automations";
import { renderAdminMail } from "./admin-mail-template";
import { unsubscribeToken } from "./admin-mail";
import { assertMailRecipient } from "./mail-delivery";

export type AutomationSubject = { user_id: string; email: string; name: string; consent_id: string; marketing_accepted_at: string;
  welcome_at: string; visited_at: string | null; product_at: string | null; cart_at: string | null; checkout_at: string | null;
  analytics_accepted: boolean | null; analytics_version: string | null; analytics_at: string | null; analytics_withdrawn_at: string | null;
  paid_at: string | null; billing_record: boolean; payment_in_progress: boolean };
const time = (value: string | null) => value ? Date.parse(value) : null;
export function automationFacts(subject: AutomationSubject, now = Date.now()): AutomationFacts | null {
  if (!subject.user_id || !subject.consent_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject.email) ||
    subject.billing_record || subject.payment_in_progress || subject.paid_at) return null;
  const consentAt = time(subject.marketing_accepted_at), analyticsAt = time(subject.analytics_at);
  if (consentAt === null || !Number.isFinite(consentAt) || consentAt > now) return null;
  return { identified: true, verifiedEmail: true, marketingAcceptedAt: consentAt, suppressed: false, withdrawn: false,
    analyticsConsent: subject.analytics_accepted === true && subject.analytics_withdrawn_at === null &&
      subject.analytics_version === LEGAL_DOCUMENT_VERSIONS.cookies && analyticsAt !== null && Number.isFinite(analyticsAt) &&
      analyticsAt <= now && now - analyticsAt < 365 * 86400000,
    paidAt: null, welcomeAt: time(subject.welcome_at), visitedAt: time(subject.visited_at), productAt: time(subject.product_at),
    cartAt: time(subject.cart_at), checkoutAt: time(subject.checkout_at) };
}

async function definitions() {
  const result = await (await database()).from("marketing_automation_drafts").select("key,steps,revision");
  if (result.error) throw Error("DATABASE_UNAVAILABLE");
  return AUTOMATION_DEFAULTS.filter(item => item.key !== "placed_order").map(item => {
    const stored = result.data?.find(row => row.key === item.key);
    return stored ? { ...item, steps: validateAutomationDraft(item.key, stored.steps), revision: stored.revision } : item;
  });
}
async function approvedRuntime() {
  if (optionalEnv("MARKETING_AUTOMATIONS_ENABLED") !== "true") return null;
  const db = await database(), result = await db.from("marketing_automation_runtime").select("*").eq("id", true).single();
  if (result.error) throw Error("DATABASE_UNAVAILABLE");
  const runtime = result.data;
  if (!runtime.enabled || !runtime.approved_by || !runtime.approved_at || Date.parse(runtime.approved_at) > Date.now() || !runtime.purchase_proof_id ||
    !runtime.enrollment_starts_at || !Number.isFinite(Date.parse(runtime.enrollment_starts_at)) || Date.parse(runtime.enrollment_starts_at) > Date.now()) return null;
  const drafts = await definitions(), digest = hash(JSON.stringify(drafts));
  if (runtime.template_digest !== digest) return null;
  const mode = optionalEnv("COMMERCE_EMAIL_MODE");
  if (!["live", "test"].includes(mode)) return null;
  if (!new RegExp(`^(sk|rk)_${mode}_`).test(getRequiredEnv("STRIPE_SECRET_KEY"))) throw Error("BILLING_MODE_MISMATCH");
  const proof = await db.from("commerce_orders").select("stripe_checkout_session_id,total,status").eq("id", runtime.purchase_proof_id).single();
  if (proof.error || proof.data.total <= 0 || ["CANCELLED", "REFUNDED"].includes(proof.data.status) ||
    !proof.data.stripe_checkout_session_id.startsWith(`cs_${mode}_`)) return null;
  return { runtime, drafts, digest, mode };
}
async function readSubject(user: string): Promise<AutomationSubject | null> {
  const result = await (await database()).from("marketing_automation_enrolled_subjects").select("*").eq("user_id", user).maybeSingle();
  if (result.error) throw Error("DATABASE_UNAVAILABLE");
  return result.data;
}
async function sentHistory(user: string): Promise<AutomationSent[]> {
  const result = await (await database()).from("marketing_automation_jobs").select("key,step,anchor,sent_at").eq("user_id", user)
    .eq("status", "sent").gte("sent_at", new Date(Date.now() - 15 * 86400000).toISOString()).limit(1001);
  if (result.error || result.data.length > 1000) throw Error("DATABASE_UNAVAILABLE");
  return result.data.map(row => ({ key: row.key, step: row.step, anchor: Date.parse(row.anchor), sentAt: Date.parse(row.sent_at) }));
}

export async function automationRuntimeActive() { return Boolean(await approvedRuntime()); }

export async function captureAutomationActivity(userId: string, kind: "site" | "viewed_product" | "cart" | "checkout" | "cart_cleared") {
  if (optionalEnv("MARKETING_AUTOMATION_CAPTURE_ENABLED") !== "true") return false;
  return rpc("record_marketing_automation_activity", { p_user: userId, p_kind: kind, p_version: LEGAL_DOCUMENT_VERSIONS.cookies });
}

export async function runMarketingAutomations(limit = 10) {
  const approved = await approvedRuntime();
  if (!approved) return { disabled: true, queued: 0, sent: 0, suppressed: 0, failed: 0 };
  const { drafts, digest, runtime, mode } = approved, db = await database();
  let candidates = db.from("marketing_automation_enrolled_subjects").select("*").order("user_id").limit(100);
  if (runtime.last_user_id) candidates = candidates.gt("user_id", runtime.last_user_id);
  const subjects = await candidates;
  if (subjects.error) throw Error("DATABASE_UNAVAILABLE");
  let queued = 0, sent = 0, suppressed = 0, failed = 0;
  for (const subject of subjects.data as AutomationSubject[]) {
    const facts = automationFacts(subject);
    if (!facts) continue;
    const planned = planAutomation(facts, await sentHistory(subject.user_id), Date.now())[0];
    if (!planned) continue;
    const draft = drafts.find(item => item.key === planned.key)!;
    if (await rpc("queue_marketing_automation", { p_user: subject.user_id, p_consent: subject.consent_id, p_key: planned.key, p_step: planned.step,
      p_anchor: new Date(planned.anchor).toISOString(), p_due: new Date(planned.dueAt).toISOString(), p_revision: draft.revision, p_digest: digest })) queued++;
  }
  const cursor = await db.from("marketing_automation_runtime").update({ last_user_id: subjects.data.length === 100 ? subjects.data.at(-1)!.user_id : null }).eq("id", true);
  if (cursor.error) throw Error("DATABASE_UNAVAILABLE");
  const { Resend } = await import("resend"), client = new Resend(getRequiredEnv("RESEND_API_KEY"));
  for (let n = 0; n < Math.max(0, Math.min(20, limit)); n++) {
    if (!await approvedRuntime()) break;
    const job = (await rpc("claim_marketing_automation"))?.[0];
    if (!job) break;
    const finish = async (values: Record<string, unknown>) => {
      const result = await db.from("marketing_automation_jobs").update(values).eq("id", job.id).eq("claim_id", job.claim_id).eq("status", "processing").select("id");
      if (result.error || result.data?.length !== 1) throw Error("EMAIL_RECEIPT_UNAVAILABLE");
    };
    try {
      const subject = await readSubject(job.user_id), facts = subject ? automationFacts(subject) : null;
      const next = facts ? planAutomation(facts, await sentHistory(job.user_id), Date.now())[0] : null;
      const draft = drafts.find(item => item.key === job.key), step = draft?.steps.find(item => item.id === job.step);
      if (!subject || subject.consent_id !== job.consent_id || !next || !step || draft!.revision !== job.revision || job.template_digest !== digest ||
        next.key !== job.key || next.step !== job.step || next.anchor !== Date.parse(job.anchor)) {
        await finish({ status: "suppressed", reason: "NO_LONGER_ELIGIBLE", provider_payload: null }); suppressed++; continue;
      }
      const recipient = mode === "test" ? getRequiredEnv("COMMERCE_TEST_EMAIL") : subject.email;
      let payload = job.provider_payload;
      if (!payload) {
        const mail = campaignAutomationMail(personalizeAutomation(step.mail, subject.name), job.key, job.step);
        const unsubscribe = `${SITE.url}/comunicaciones/baja?token=${unsubscribeToken(subject.email)}`;
        payload = { from: `Imperio E <${SITE.contactEmail}>`, replyTo: SITE.contactEmail, to: recipient, subject: mail.subject,
          ...renderAdminMail(mail, unsubscribe, true), headers: { "List-Unsubscribe": `<${unsubscribe}>` } };
        const saved = await db.from("marketing_automation_jobs").update({ provider_payload: payload }).eq("id", job.id).eq("claim_id", job.claim_id)
          .eq("status", "processing").is("provider_payload", null).select("id");
        if (saved.error || saved.data?.length !== 1) throw Error("EMAIL_SNAPSHOT_UNAVAILABLE");
      }
      assertMailRecipient(payload, mode, recipient);
      if (payload.to !== recipient || payload.cc || payload.bcc) throw Error("EMAIL_RECIPIENT_CHANGED");
      // Re-read immediately before transmission: a purchase or withdrawal may have cancelled this lease.
      const latest = await readSubject(job.user_id), latestFacts = latest ? automationFacts(latest) : null;
      const latestPlan = latestFacts ? planAutomation(latestFacts, await sentHistory(job.user_id), Date.now())[0] : null;
      const lease = await db.from("marketing_automation_jobs").select("status,claim_id").eq("id", job.id).single();
      if (lease.error) throw Error("DATABASE_UNAVAILABLE");
      if (!latest || !latestPlan || latest.email !== subject.email || latest.consent_id !== job.consent_id || latestPlan.key !== job.key ||
        latestPlan.step !== job.step || latestPlan.anchor !== Date.parse(job.anchor) || lease.data.status !== "processing" || lease.data.claim_id !== job.claim_id ||
        (await approvedRuntime())?.digest !== digest) {
        if (lease.data.status === "processing") await finish({ status: "suppressed", reason: "ELIGIBILITY_CHANGED", provider_payload: null });
        suppressed++; continue;
      }
      const response = await client.emails.send(payload, { idempotencyKey: `automation-${job.id}` });
      if (response.error || !response.data) throw Error("EMAIL_PROVIDER_UNAVAILABLE");
      await finish({ status: "sent", provider_id: response.data.id, sent_at: new Date().toISOString(), provider_payload: null, delivery_status: "accepted_by_provider" }); sent++;
    } catch { failed++; }
    await new Promise(resolve => { setTimeout(resolve, 600); });
  }
  return { disabled: false, queued, sent, suppressed, failed };
}

export async function automationDeliveryReceipts(limit = 10) {
  const approved = await approvedRuntime();
  if (!approved) return { disabled: true, checked: 0 };
  const db = await database(), { Resend } = await import("resend"), client = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const jobs = await db.from("marketing_automation_jobs").select("id,user_id,provider_id").eq("status", "sent")
    .gte("sent_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .or(`provider_checked_at.is.null,provider_checked_at.lt.${new Date(Date.now() - 3600000).toISOString()}`)
    .order("provider_checked_at", { nullsFirst: true }).limit(Math.min(20, Math.max(0, limit)));
  if (jobs.error) throw Error("DATABASE_UNAVAILABLE");
  let checked = 0;
  for (const job of jobs.data ?? []) {
    const response = await client.emails.get(job.provider_id);
    if (response.error || !response.data) continue;
    const event = String(response.data.last_event), status = ["opened", "clicked"].includes(event) ? "delivered" : event;
    const saved = await db.from("marketing_automation_jobs").update({ delivery_status: status, provider_checked_at: new Date().toISOString() }).eq("id", job.id).eq("provider_id", job.provider_id);
    if (saved.error) throw Error("DATABASE_UNAVAILABLE");
    if (["bounced", "complained"].includes(status)) {
      const recipient = response.data.to?.[0]?.trim().toLowerCase();
      if (approved.mode === "live" && recipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        await rpc("suppress_marketing_email", { p_email: recipient, p_reason: `provider_${status}` });
      }
    }
    checked++;
    await new Promise(resolve => { setTimeout(resolve, 600); });
  }
  return { disabled: false, checked };
}
