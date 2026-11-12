import { SITE } from "../config/site";
import { renderAdminMail } from "./admin-mail-template";
import { prepareCorporateEmail } from "./corporate-email";
import { createCorporateMailClient, sendCorporateMail } from "./customer-mail-service";
import { unsubscribeToken } from "./admin-mail";
import { assertMailRecipient } from "./mail-delivery";
import { database, hash, optionalEnv, rpc } from "./reservations";
import { getRequiredEnv } from "./env";
import { deliveryMessageEligible, postDeliveryDelay, receiptCapability, type PostDeliveryKind } from "./post-delivery";

type DeliveryJob = { id: string; order_id: string; kind: PostDeliveryKind; recipient: string; order_number: string;
  token_expires_at: string; claim_id: string; template_digest: string | null; };
export function postDeliveryMessage(job: DeliveryJob, secret: string) {
  const service = job.kind === "delivery_check";
  const token = service ? receiptCapability(job.id, Date.parse(job.token_expires_at), secret) : "";
  const mail = service ? {
    subject: "¿Te ha llegado la camiseta correctamente?", preheader: "Comprueba la recepción de tu pedido o avísanos si necesitas ayuda.",
    content: `El transportista ha comunicado la entrega del pedido ${job.order_number}. Queremos comprobar si lo has recibido correctamente.\n\nPuedes confirmar la recepción o comunicar una incidencia desde el enlace seguro. La entrega logística y tu confirmación se registran por separado. Si falta un paquete, indica únicamente el que has recibido.\n\nSi necesitas ayuda, responde a este correo o escribe a ${SITE.contactEmail}. Este mensaje se refiere al servicio de tu pedido.`,
    cta_label: "Confirmar recepción o comunicar un problema", cta_url: `${SITE.url}/pedidos/recepcion#${token}`,
  } : {
    subject: "Gracias por compartir nuestra historia", preheader: "Tu experiencia con la Camiseta Imperial y la comunidad de Imperio Español.",
    content: `Gracias por confirmar la recepción de tu pedido ${job.order_number}. Esperamos que disfrutes la Camiseta Imperial.\n\nLa Cruz de Borgoña y la nao evocan símbolos y travesías de la Monarquía Hispánica y del Siglo de Oro. Puedes seguir descubriendo su historia y las novedades de la comunidad en nuestra web.\n\nSi te apetece compartir una reseña o una fotografía, puedes responder a este correo. Participar es voluntario. Antes de publicar tu imagen, testimonio o nombre te pediremos una autorización específica: aceptar la newsletter no autoriza su publicación.`,
    cta_label: "Descubrir Imperio Español", cta_url: SITE.url,
  };
  const unsubscribe = service ? undefined : `${SITE.url}/comunicaciones/baja?token=${unsubscribeToken(job.recipient)}`;
  return { subject: mail.subject, ...renderAdminMail(mail, unsubscribe), ...(unsubscribe ? { headers: { "List-Unsubscribe": `<${unsubscribe}>` } } : {}) };
}

function runtime() {
  if (optionalEnv("POST_DELIVERY_ENABLED") !== "true") return null;
  const startsAt = optionalEnv("POST_DELIVERY_ENROLLMENT_STARTS_AT");
  if (!startsAt || !Number.isFinite(Date.parse(startsAt)) || Date.parse(startsAt) > Date.now()) return null;
  const mode = optionalEnv("COMMERCE_EMAIL_MODE");
  if (!["test", "live"].includes(mode)) return null;
  if (!new RegExp(`^(sk|rk)_${mode}_`).test(getRequiredEnv("STRIPE_SECRET_KEY"))) throw Error("BILLING_MODE_MISMATCH");
  if (mode === "test" && !optionalEnv("COMMERCE_TEST_EMAIL")) throw Error("EMAIL_TEST_RECIPIENT_REQUIRED");
  return { mode, startsAt, loyalty: optionalEnv("POST_DELIVERY_LOYALTY_ENABLED") === "true",
    checkHours: postDeliveryDelay(optionalEnv("POST_DELIVERY_CHECK_DELAY_HOURS"), 48),
    loyaltyHours: postDeliveryDelay(optionalEnv("POST_DELIVERY_LOYALTY_DELAY_HOURS"), 72) };
}

export async function runPostDelivery(limit = 3) {
  const active = runtime();
  if (!active) return { disabled: true, queued: 0, sent: 0, cancelled: 0, failed: 0 };
  const queued = await rpc("queue_post_delivery_jobs", { p_starts_at: active.startsAt, p_check_hours: active.checkHours,
    p_loyalty_hours: active.loyaltyHours, p_loyalty: active.loyalty });
  const db = await database(), client = createCorporateMailClient(getRequiredEnv("RESEND_API_KEY"));
  let sent = 0, cancelled = 0, failed = 0;
  for (let n = 0; n < Math.min(10, Math.max(0, limit)); n++) {
    if (!runtime()) break;
    const job: DeliveryJob | undefined = (await rpc("claim_post_delivery_job", { p_loyalty: active.loyalty }))?.[0];
    if (!job) break;
    const finish = async (values: Record<string, unknown>) => {
      const saved = await db.from("post_delivery_jobs").update(values).eq("id", job.id).eq("claim_id", job.claim_id)
        .eq("status", "processing").select("id");
      if (saved.error || saved.data?.length !== 1) throw Error("EMAIL_RECEIPT_UNAVAILABLE");
    };
    try {
      const recipient = active.mode === "test" ? getRequiredEnv("COMMERCE_TEST_EMAIL") : job.recipient;
      const message = prepareCorporateEmail({ from: `Imperio Español <${SITE.contactEmail}>`, replyTo: SITE.contactEmail,
        to: recipient, ...postDeliveryMessage(job, getRequiredEnv("RESERVATION_TOKEN_SECRET")) });
      const digest = hash(JSON.stringify(message));
      if (job.template_digest && job.template_digest !== digest) {
        await finish({ status: "review", last_error: "TEMPLATE_CHANGED_DURING_RETRY", claim_id: null }); failed++; continue;
      }
      if (!job.template_digest) await finish({ template_digest: digest });
      // Check source facts and lease immediately before transmission. A payment,
      // order-open or sent-mail event can never establish physical receipt.
      const order = await db.from("commerce_orders").select("status,paid_at,carrier_delivered_at,customer_received_at,delivery_issue_at,delivery_returned_at,delivery_disputed_at,delivery_paused_at,refunded_amount,customer_email")
        .eq("id", job.order_id).single();
      const lease = await db.from("post_delivery_jobs").select("status,claim_id").eq("id", job.id).single();
      if (order.error || lease.error) throw Error("DATABASE_UNAVAILABLE");
      const marketing = job.kind === "post_delivery_loyalty" ? await rpc("post_delivery_marketing_eligible", { p_email: job.recipient }) : false;
      const latestRuntime = runtime();
      const eligible = latestRuntime && latestRuntime.startsAt === active.startsAt && latestRuntime.mode === active.mode &&
        (job.kind !== "post_delivery_loyalty" || latestRuntime.loyalty) && !order.data.delivery_paused_at &&
        order.data.customer_email.trim().toLowerCase() === job.recipient && deliveryMessageEligible(order.data, job.kind, marketing);
      if (!eligible || lease.data.status !== "processing" || lease.data.claim_id !== job.claim_id) {
        if (lease.data.status === "processing" && lease.data.claim_id === job.claim_id)
          await finish({ status: "cancelled", claim_id: null, last_error: "ELIGIBILITY_CHANGED" });
        cancelled++; continue;
      }
      assertMailRecipient(message, active.mode, recipient);
      const response = await sendCorporateMail(client, message, { idempotencyKey: `post-delivery-v1-${job.id}` });
      if (response.error || !response.data) throw Error("EMAIL_PROVIDER_UNAVAILABLE");
      await finish({ status: "sent", sent_at: new Date().toISOString(), provider_id: response.data.id,
        provider_status: "accepted_by_provider", last_error: null });
      const updated = await db.from("commerce_orders").update({ last_email_at: new Date().toISOString(), next_email_at: null,
        post_delivery_stage: `${job.kind}_sent` }).eq("id", job.order_id);
      if (updated.error) throw Error("DATABASE_UNAVAILABLE");
      sent++;
    } catch {
      // Preserve the lease, recipient and digest for a bounded, idempotent retry.
      await db.from("post_delivery_jobs").update({ last_error: "DELIVERY_ATTEMPT_FAILED" }).eq("id", job.id).eq("claim_id", job.claim_id).eq("status", "processing");
      failed++;
    }
  }
  return { disabled: false, queued, sent, cancelled, failed };
}
