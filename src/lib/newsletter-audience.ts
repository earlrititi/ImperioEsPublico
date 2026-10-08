import { readAll } from "./admin-data";
import { database } from "./reservations";
import { verifiedSubscriptions } from "./subscription-reconciliation";
export const NEWSLETTER_SEGMENTS = ["shirts", "subscriptions", "arcabucero", "maestre_campo", "both", "all"] as const;
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
  const reservations = await readAll("reservations", "id,customer_email,status,marketing_withdrawn_at");
  const reconciliation = segment === "shirts" ? null : await verifiedSubscriptions();
  const profiles = await readAll("profiles", "id,email");
  const consent = await readAll("legal_consents", "id,user_id,consent_type,withdrawn_at");
  const suppressionResult = await (await database()).from("email_suppressions").select("email").limit(10000);
  if (suppressionResult.error) throw new Error("DATABASE_UNAVAILABLE");
  if (suppressionResult.data?.length === 10000) throw new Error("AUDIENCE_TOO_LARGE");
  const suppressed = new Set((suppressionResult.data ?? []).map(r => normalizeEmail(r.email)));
  for (const r of reservations) if (r.marketing_withdrawn_at) suppressed.add(normalizeEmail(r.customer_email));
  for (const c of consent) if (c.consent_type === "marketing_email" && c.withdrawn_at && c.user_id) {
    const email = profiles.find(p => p.id === c.user_id)?.email;
    if (email) suppressed.add(normalizeEmail(email));
  }
  const shirts = reservations.filter(r => ["RESERVED", "PURCHASE_AVAILABLE", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)).map(r => normalizeEmail(r.customer_email));
  // Reconciled paid subscriptions only, never checkout interests or Piquero registrations.
  const paid = (reconciliation?.verified ?? []).filter(s => s.status === "active" &&
    !reconciliation?.duplicateEmails.includes(s.email));
  const subscribers = paid.map(s => normalizeEmail(s.email));
  const emails = segment === "shirts" ? shirts : segment === "subscriptions" ? subscribers :
    segment === "both" ? shirts.filter(email => subscribers.includes(email)) : segment === "all" ? [...shirts, ...subscribers] :
    paid.filter(s => s.plan === segment).map(s => normalizeEmail(s.email));
  return filterAudience(emails, suppressed);
}
