import { readAll } from "./admin-data";
import { database } from "./reservations";
import { verifiedSubscriptions } from "./subscription-reconciliation";
export const NEWSLETTER_SEGMENTS = ["shirts", "subscriptions", "arcabucero", "maestre_campo", "both", "all", "manifesto", "leads"] as const;
export type NewsletterSegment = typeof NEWSLETTER_SEGMENTS[number];
export const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
export const validEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function filterAudience(emails: string[], suppressed: Set<string>) {
  const valid = emails.map(normalizeEmail).filter(validEmail);
  const unique = [...new Set(valid)];
  return { original: emails.length, invalid: emails.length - valid.length, duplicates: valid.length - unique.length,
    unsubscribed: unique.filter(email => suppressed.has(email)).length,
    recipients: unique.filter(email => !suppressed.has(email)) };
}

export async function newsletterAudience(segment: NewsletterSegment) {
  if (!NEWSLETTER_SEGMENTS.includes(segment)) throw new Error("INVALID_SEGMENT");
  const reservations = await readAll("reservations", "id,customer_email,status,marketing_consent,marketing_withdrawn_at");
  const reconciliation = ["shirts","manifesto","leads"].includes(segment) ? null : await verifiedSubscriptions();
  const profiles = await readAll("profiles", "id,email");
  const consent = await readAll("legal_consents", "id,user_id,consent_type,accepted,withdrawn_at");
  const manifesto=await readAll("manifesto_requests","id,email,status,marketing_consent");
  const leads=await readAll("marketing_leads","id,email,marketing_accepted_at");
  const suppressionResult = await (await database()).from("email_suppressions").select("email").limit(10000);
  if (suppressionResult.error) throw new Error("DATABASE_UNAVAILABLE");
  if (suppressionResult.data?.length === 10000) throw new Error("AUDIENCE_TOO_LARGE");
  const suppressed = new Set((suppressionResult.data ?? []).map(r => normalizeEmail(r.email)));
  for (const r of reservations) if (r.marketing_withdrawn_at) suppressed.add(normalizeEmail(r.customer_email));
  for (const c of consent) if (c.consent_type === "marketing_email" && c.withdrawn_at && c.user_id) {
    const email = profiles.find(p => p.id === c.user_id)?.email;
    if (email) suppressed.add(normalizeEmail(email));
  }
  const shirts = reservations.filter(r => r.marketing_consent===true && ["RESERVED", "PURCHASE_AVAILABLE", "PAYMENT_PENDING", "PAYMENT_FAILED","CONVERTED_TO_ORDER"].includes(r.status)).map(r => normalizeEmail(r.customer_email));
  // Reconciled paid subscriptions only, never checkout interests or Piquero registrations.
  const paid = (reconciliation?.verified ?? []).filter(s => s.status === "active" &&
    !reconciliation?.duplicateEmails.includes(s.email));
  const optedIn=new Set(consent.filter(c=>c.consent_type==="marketing_email"&&c.accepted===true&&!c.withdrawn_at).map(c=>profiles.find(p=>p.id===c.user_id)?.email).filter(Boolean).map(normalizeEmail));
  for(const r of reservations)if(r.marketing_consent===true&&!r.marketing_withdrawn_at)optedIn.add(normalizeEmail(r.customer_email));
  for(const m of manifesto)if(m.marketing_consent===true&&m.status==="accepted")optedIn.add(normalizeEmail(m.email));
  for(const l of leads)if(l.marketing_accepted_at)optedIn.add(normalizeEmail(l.email));
  const subscribers = paid.map(s => normalizeEmail(s.email)).filter(email=>optedIn.has(email));
  const manifestoEmails=manifesto.filter(m=>m.status==="accepted"&&m.marketing_consent===true).map(m=>normalizeEmail(m.email));
  const leadEmails=leads.filter(l=>l.marketing_accepted_at).map(l=>normalizeEmail(l.email));
  const emails = segment === "shirts" ? shirts : segment === "subscriptions" ? subscribers :
    segment === "manifesto"?manifestoEmails:segment==="leads"?leadEmails:
    segment === "both" ? shirts.filter(email => subscribers.includes(email)) : segment === "all" ? [...shirts, ...subscribers,...manifestoEmails,...leadEmails] :
    paid.filter(s => s.plan === segment&&optedIn.has(normalizeEmail(s.email))).map(s => normalizeEmail(s.email));
  return filterAudience(emails, suppressed);
}
