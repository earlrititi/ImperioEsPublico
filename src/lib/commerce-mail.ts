import {
  formatMoney,
  PROVINCES,
  RESERVATION_STATUS,
  RESERVATION_PURCHASE_NOTICE,
  SHIRT_PRICE_COPY,
} from "../config/commerce";
import {
  database,
  managementLink,
  optionalEnv,
  readReservation,
  rpc,
} from "./reservations";
import { getRequiredEnv } from "./env";
import { SITE } from "../config/site";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function messageKey() {
  return createHash("sha256")
    .update(`commerce-mail:${getRequiredEnv("RESERVATION_TOKEN_SECRET")}`)
    .digest();
}
function seal(message: unknown, id: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", messageKey(), nonce);
  cipher.setAAD(Buffer.from(id));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(message), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
    "base64",
  );
}
function unseal(value: string, id: string) {
  const b = Buffer.from(value, "base64"),
    cipher = createDecipheriv("aes-256-gcm", messageKey(), b.subarray(0, 12));
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}

export function reservationMailText(r: any, kind: string, url: string) {
  const paid = Boolean(r.commerce_orders);
  const a = paid ? r.commerce_orders.shipping_address : r.shipping_address;
  return [
    paid ? "Pedido confirmado" : "Reserva anticipada",
    r.number,
    `Estado: ${RESERVATION_STATUS[r.status] ?? r.status}`,
    ...r.reservation_items.map(
      (i: any) =>
        `${i.product_name}, ${i.sku}, talla ${i.size}, ${i.color}: ${i.quantity} x ${formatMoney(i.unit_price_snapshot)} = ${formatMoney(i.line_total_snapshot)}`,
    ),
    `Precio final por camiseta: ${formatMoney(r.reservation_items[0].unit_price_snapshot)}`,
    SHIRT_PRICE_COPY,
    `Total ${paid ? "pagado" : "informativo reservado"}: ${formatMoney(r.total_price_snapshot)}`,
    a?.name,
    a?.line1,
    a?.line2,
    a ? `${a.postalCode} ${a.city}, ${PROVINCES.find(([code]) => code === a.province)?.[1] ?? a.province}, Espana` : null,
    r.customer_phone ? `Telefono: ${r.customer_phone}` : null,
    paid
      ? "Pago confirmado. Consulta el estado de tu pedido."
      : ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(r.status)
        ? "El pago no se ha confirmado todavia."
        : "NO SE HA REALIZADO NINGUN COBRO.",
    r.expires_at
      ? `Reserva valida hasta: ${new Date(r.expires_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora peninsular)`
      : "Recibiras el plazo de compra en la invitacion. No tienes obligacion de comprar.",
    r.status === "WAITLIST" ? "Lista de espera: no se ha asignado stock. Avisaremos por orden de entrada si se libera una unidad." : null,
    kind === "PURCHASE_AVAILABLE"
      ? "Ya puedes revisar tu reserva y confirmar expresamente el pago."
      : "La reserva no autoriza cargos futuros.",
    !paid && r.status === "RESERVED" ? RESERVATION_PURCHASE_NOTICE : null,
    !paid && r.status === "RESERVED"
      ? `Consultar o gestionar tu reserva (este no es el enlace de compra): ${url}`
      : `Consultar o gestionar: ${url}`,
    `Soporte: ${SITE.contactEmail}`,
  ]
    .filter(Boolean)
    .join("\n");
}
export async function drainCommerceMail(limit = 10) {
  const mode = optionalEnv("COMMERCE_EMAIL_MODE");
  if (!["test", "live"].includes(mode)) return { sent: 0, disabled: true };
  if (mode === "test" && !optionalEnv("COMMERCE_TEST_EMAIL"))
    throw new Error("EMAIL_TEST_RECIPIENT_REQUIRED");
  const db = await database();
  let sent = 0;
  for (let n = 0; n < limit; n++) {
    const jobs = await rpc("claim_commerce_mail");
    const job = jobs?.[0];
    if (!job) break;
    try {
      const { Resend } = await import("resend");
      const client = new Resend(getRequiredEnv("RESEND_API_KEY"));
      let message;
      if (job.encrypted_message)
        message = unseal(job.encrypted_message, job.id);
      else {
        const r = await readReservation(job.reservation_id);
        message = {
          from: `Imperio Espanol <${SITE.contactEmail}>`,
          to:
            mode === "test"
              ? getRequiredEnv("COMMERCE_TEST_EMAIL")
              : r.customer_email,
          subject: job.kind === "RESERVED" && r.status === "RESERVED"
            ? "Tu camiseta Imperio E est\u00e1 reservada"
            : `${r.commerce_orders ? "Pedido" : "Reserva"} ${r.number}: ${RESERVATION_STATUS[r.status] ?? r.status}`,
          text: reservationMailText(r, job.kind, managementLink(r)),
          replyTo: SITE.contactEmail,
        };
        const saved = await db
          .from("commerce_outbox")
          .update({ encrypted_message: seal(message, job.id) })
          .eq("id", job.id)
          .eq("claim_id", job.claim_id)
          .is("encrypted_message", null)
          .select("id");
        if (saved.error || saved.data?.length !== 1)
          throw new Error("EMAIL_SNAPSHOT_UNAVAILABLE");
      }
      const response = await client.emails.send(message, {
        idempotencyKey: `commerce-mail-${job.id}`,
      });
      if (response.error || !response.data)
        throw new Error("EMAIL_PROVIDER_UNAVAILABLE");
      const { error } = await db
        .from("commerce_outbox")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          provider_id: response.data.id,
          encrypted_message: null,
        })
        .eq("id", job.id)
        .eq("claim_id", job.claim_id);
      if (error) throw new Error("EMAIL_RECEIPT_UNAVAILABLE");
      sent++;
    } catch {
      // Leave the durable lease for a later retry with the same provider idempotency key.
    }
  }
  return { sent, disabled: false };
}
