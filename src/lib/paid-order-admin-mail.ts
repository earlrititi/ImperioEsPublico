import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SITE } from "../config/site";
import { ADMIN_NOTIFICATION_EMAIL, paidOrderNotification } from "./admin-notifications";
import { getRequiredEnv } from "./env";
import { database, optionalEnv, rpc } from "./reservations";
import { UUID } from "./reservation-validation";

function messageKey() {
  return createHash("sha256").update(`paid-order-admin:${getRequiredEnv("RESERVATION_TOKEN_SECRET")}`).digest();
}
function seal(message: unknown, id: string) {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", messageKey(), nonce);
  cipher.setAAD(Buffer.from(id));
  const data = Buffer.concat([cipher.update(JSON.stringify(message), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString("base64");
}
function unseal(value: string, id: string) {
  const data = Buffer.from(value, "base64"), cipher = createDecipheriv("aes-256-gcm", messageKey(), data.subarray(0, 12));
  cipher.setAAD(Buffer.from(id)); cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString("utf8"));
}

export async function drainPaidOrderAdminMail(limit = 10, orderId?: string) {
  const mode = optionalEnv("COMMERCE_EMAIL_MODE");
  if (!["live", "test"].includes(mode)) return { sent: 0, failed: 0, disabled: true };
  if (!/^(sk|rk)_(test|live)_/.test(getRequiredEnv("STRIPE_SECRET_KEY"))) throw Error("INVALID_STRIPE_MODE");
  const expectedMode = /^(sk|rk)_live_/.test(getRequiredEnv("STRIPE_SECRET_KEY")) ? "live" : "test";
  if (mode !== expectedMode) throw Error("BILLING_MODE_MISMATCH");
  if (orderId && !UUID.test(orderId)) throw Error("INVALID_INPUT");
  const recipient = mode === "test" ? getRequiredEnv("COMMERCE_TEST_EMAIL") : ADMIN_NOTIFICATION_EMAIL;
  const db = await database(), { Resend } = await import("resend");
  const client = new Resend(getRequiredEnv("RESEND_API_KEY"));
  let sent = 0, failed = 0;
  for (let n = 0; n < Math.max(0, Math.min(limit, 20)); n++) {
    const job = (await rpc("claim_paid_order_admin_notice", { p_order: orderId ?? null }))?.[0];
    if (!job) break;
    try {
      let message;
      if (job.encrypted_message) message = unseal(job.encrypted_message, job.order_id);
      else {
        const order = await db.from("commerce_orders").select("*,commerce_order_items(*)").eq("id", job.order_id).single();
        if (order.error || !order.data?.stripe_checkout_session_id?.startsWith(`cs_${mode}_`)) throw Error("ORDER_NOTICE_DATA_UNAVAILABLE");
        message = { from: `Imperio E <${SITE.contactEmail}>`, to: recipient, replyTo: SITE.contactEmail, ...paidOrderNotification(order.data) };
        const saved = await db.from("paid_order_admin_outbox").update({ encrypted_message: seal(message, job.order_id) })
          .eq("order_id", job.order_id).eq("claim_id", job.claim_id).is("encrypted_message", null).select("order_id");
        if (saved.error || saved.data?.length !== 1) throw Error("EMAIL_SNAPSHOT_UNAVAILABLE");
      }
      if (message.to !== recipient || message.cc || message.bcc) throw Error("ADMIN_RECIPIENT_MISMATCH");
      const response = await client.emails.send(message, { idempotencyKey: `paid-order-admin-${job.order_id}` });
      if (response.error || !response.data) throw Error("EMAIL_PROVIDER_UNAVAILABLE");
      if (!await rpc("finish_paid_order_admin_notice", { p_order: job.order_id, p_claim: job.claim_id, p_provider: response.data.id })) throw Error("EMAIL_RECEIPT_UNAVAILABLE");
      sent++;
    } catch {
      failed++;
      // Keep the immutable snapshot and lease for retry; never replay customer mail.
      console.error("Paid order admin email retained for retry");
    }
    await new Promise(resolve => { setTimeout(resolve, 600); });
  }
  return { sent, failed, disabled: false };
}

export async function reconcilePaidOrderAdminDelivery(limit = 10) {
  if (!["live", "test"].includes(optionalEnv("COMMERCE_EMAIL_MODE"))) return { checked: 0, disabled: true };
  const db = await database(), { Resend } = await import("resend"), client = new Resend(getRequiredEnv("RESEND_API_KEY"));
  const cutoff = new Date(Date.now() - 3600000).toISOString();
  const jobs = await db.from("paid_order_admin_outbox").select("order_id,provider_id").eq("status", "SENT")
    .gte("sent_at", new Date(Date.now() - 7 * 86400000).toISOString()).or(`provider_checked_at.is.null,provider_checked_at.lt.${cutoff}`)
    .order("provider_checked_at", { nullsFirst: true }).limit(Math.max(0, Math.min(limit, 20)));
  if (jobs.error) throw Error("DATABASE_UNAVAILABLE");
  let checked = 0;
  for (const job of jobs.data ?? []) {
    if (!job.provider_id) continue;
    const result = await client.emails.get(job.provider_id);
    if (result.error || !result.data) continue;
    const event = String(result.data.last_event), status = ["opened", "clicked"].includes(event) ? "delivered" : event;
    const saved = await db.from("paid_order_admin_outbox").update({ delivery_status: status, provider_checked_at: new Date().toISOString() })
      .eq("order_id", job.order_id).eq("provider_id", job.provider_id);
    if (saved.error) throw Error("DATABASE_UNAVAILABLE");
    const history = await db.from("admin_notification_history").update({ delivery_status: status }).eq("id", `paid_order_admin_${job.order_id}`);
    if (history.error) throw Error("DATABASE_UNAVAILABLE");
    checked++;
    await new Promise(resolve => { setTimeout(resolve, 600); });
  }
  return { checked, disabled: false };
}
