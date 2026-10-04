import { createHash } from "node:crypto";
import { SITE } from "../config/site";
import { ADMIN_NOTIFICATION_EMAIL, leadNotification } from "./admin-notifications";
import { claimStripeEvent, completeStripeEvent, failStripeEvent } from "./stripe-events";
import { optionalEnv } from "./reservations";

export async function notifyLead(params: {
  kind: "registration" | "manifesto" | "subscription_interest";
  reference: string;
  email: string;
  name?: string;
  plan?: string;
}) {
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
    await completeStripeEvent(id);
  } catch (error) {
    await failStripeEvent(id, error);
    throw error;
  }
}
