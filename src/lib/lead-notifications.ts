import { createHash } from "node:crypto";
import { SITE } from "../config/site";
import { ADMIN_NOTIFICATION_EMAIL, leadNotification } from "./admin-notifications";
import { claimStripeEvent, completeStripeEvent, failStripeEvent } from "./stripe-events";
import { optionalEnv, database } from "./reservations";

export async function notifyLead(params: {
  kind: "registration" | "manifesto" | "subscription_interest";
  reference: string;
  email: string;
  name?: string;
  plan?: string;
}) {
  if(optionalEnv("COMMERCE_EMAIL_MODE")==="disabled")return;
  const id = `admin_lead_${createHash("sha256").update(`${params.kind}:${params.reference}`).digest("hex")}`;
  if (!await claimStripeEvent({ eventId: id, eventType: `internal.${params.kind}_notification` })) return;
  try {
    const { resend } = await import("./resend");
    const recipient = optionalEnv("COMMERCE_EMAIL_MODE") === "test"
      ? optionalEnv("COMMERCE_TEST_EMAIL") : ADMIN_NOTIFICATION_EMAIL;
    if (!recipient) throw new Error("EMAIL_TEST_RECIPIENT_REQUIRED");
    const result = await resend.emails.send({
      from: `Imperio Español <${SITE.contactEmail}>`,
      to: recipient,
      replyTo: SITE.contactEmail,
      ...leadNotification(params),
    }, { idempotencyKey: id });
    if (result.error || !result.data) throw new Error("ADMIN_EMAIL_PROVIDER_UNAVAILABLE");
    const notice=leadNotification(params);
    const saved=await (await database()).from("admin_notification_history").upsert({id,kind:params.kind==="subscription_interest"?"checkout_interest":params.kind,
      customer_email:params.email.toLowerCase(),subject:notice.subject,source:"application",delivery_status:"accepted_by_provider"},{onConflict:"id"});
    if(saved.error)throw new Error("DATABASE_UNAVAILABLE");
    await completeStripeEvent(id);
  } catch (error) {
    await failStripeEvent(id, error);
    throw error;
  }
}
