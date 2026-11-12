import type { APIRoute } from "astro";
import { database, optionalEnv, rpc } from "../../lib/reservations";
import {
  resendDedupeKey,
  resendDeliveryState,
  resendEventType,
  resendMessageId,
  resendOccurredAt,
  resendRecipient,
  safeEventDetail,
  suppressionReason,
  verifySvixSignature,
} from "../../lib/resend-webhook";

export const prerender = false;

const MAX_BODY = 256 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" },
});

async function resolveEmail(messageId: string) {
  const db = await database();
  const central = await db.from("customer_mail_deliveries").select("recipient").eq("provider_id", messageId).limit(1).maybeSingle();
  if (!central.error && central.data?.recipient) return String(central.data.recipient).toLowerCase();
  const job = await db.from("marketing_automation_jobs")
    .select("contact_email,user_id")
    .eq("provider_id", messageId)
    .limit(1)
    .maybeSingle();
  if (!job.error && job.data?.contact_email) return String(job.data.contact_email);
  if (!job.error && job.data?.user_id) {
    const profile = await db.from("profiles").select("email").eq("id", job.data.user_id).maybeSingle();
    if (!profile.error && profile.data?.email) return String(profile.data.email).toLowerCase();
  }
  const logged = await db.from("email_logs")
    .select("recipient")
    .eq("provider_message_id", messageId)
    .limit(1)
    .maybeSingle();
  if (!logged.error && logged.data?.recipient) return String(logged.data.recipient).toLowerCase();
  return "";
}

async function applyReceipt(messageId: string, eventType: ReturnType<typeof resendEventType>, occurredAt: string) {
  if (!eventType) return;
  const state = resendDeliveryState(eventType);
  if (!state) return;
  const db = await database();
  const patch: Record<string, unknown> = {
    delivery_status: state.status,
    provider_checked_at: new Date().toISOString(),
    ...(state.confirmed ? { provider_delivery_confirmed_at: occurredAt } : {}),
  };
  const updates = [
    db.from("customer_mail_deliveries").update(patch).eq("provider_id", messageId),
    db.from("marketing_automation_jobs").update(patch).eq("provider_id", messageId),
    db.from("email_logs").update(patch).eq("provider_message_id", messageId),
    db.from("paid_order_admin_outbox").update(patch).eq("provider_id", messageId),
    db.from("seo_jobs").update(patch).eq("provider_id", messageId),
    db.from("post_delivery_jobs").update({ provider_status: state.status }).eq("provider_id", messageId),
  ];
  const results = await Promise.allSettled(updates);
  for (const result of results) {
    if (result.status === "rejected") console.error("Resend receipt update failed:", result.reason);
  }
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  if (body.length > MAX_BODY) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
  const secret = optionalEnv("RESEND_WEBHOOK_SECRET");
  if (!secret) return json({ error: "WEBHOOK_NOT_CONFIGURED" }, 503);
  const verified = verifySvixSignature({
    headers: {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body,
    secret,
  });
  if (!verified) return new Response("Invalid signature", { status: 400 });

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  const eventType = resendEventType(payload?.type);
  if (!eventType) return json({ received: true, ignored: true });
  const data = payload?.data ?? {};
  const messageId = resendMessageId(data);
  if (!messageId) return json({ received: true, ignored: true });
  const occurredAt = resendOccurredAt(payload);
  const email = resendRecipient(data) || await resolveEmail(messageId);
  if (!email) return json({ received: true, ignored: true });

  const db = await database();
  const inserted = await db.from("email_provider_events").upsert({
    provider: "resend",
    provider_message_id: messageId,
    email,
    event_type: eventType,
    occurred_at: occurredAt,
    url: safeEventDetail(eventType, data).url ?? null,
    detail: safeEventDetail(eventType, data),
    dedupe_key: resendDedupeKey({
      svixId: request.headers.get("svix-id"),
      eventType,
      messageId,
      occurredAt,
    }),
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (inserted.error) {
    console.error("Resend webhook event could not be stored:", inserted.error);
    return json({ error: "EVENT_STORE_UNAVAILABLE" }, 503);
  }

  await applyReceipt(messageId, eventType, occurredAt);
  const reason = suppressionReason(eventType, data);
  if (reason) {
    await rpc("suppress_marketing_email", { p_email: email, p_reason: reason }).catch(error => {
      console.error("Resend suppression could not be applied:", error);
    });
  }
  return json({ received: true });
};
