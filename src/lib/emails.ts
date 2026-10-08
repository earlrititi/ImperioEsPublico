import { getRequiredEnv } from "./env";
import { resend } from "./resend";
import { SITE } from "../config/site";
import { TSHIRT_OFFER_COPY } from "../config/tshirt-offer";

const from = `Imperio Espanol <${SITE.contactEmail}>`;

function greeting(name?: string | null) {
  return name ? `Bienvenido, ${name}` : "Bienvenido";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function sendTshirtDiscountEmail(params: { to: string; name: string; code: string; percent: number; reference: string }) {
  const siteUrl = getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
  const name = escapeHtml(params.name);
  const code = escapeHtml(params.code);
  const plan = params.percent === 20 ? "Maestre de Campo" : "Arcabucero";
  return resend.emails.send({
    from,
    replyTo: SITE.contactEmail,
    to: params.to,
    subject: `Tu ${params.percent}% para la Camiseta Imperial`,
    html: `<div style="font-family:Georgia,serif;line-height:1.6;color:#111"><h1>Una pieza de nuestra historia</h1><p>Hola ${name},</p><p>Tu suscripción ${plan} está activa. Tu descuento del ${params.percent}% para la Camiseta Imperial está preparado.</p><p><strong>Código: ${code}</strong></p><p>${TSHIRT_OFFER_COPY} Se aplica automáticamente al confirmar la compra, no al reservar. La compra se habilita el 12 de octubre de 2026.</p><p><a href="${siteUrl}/tienda">Ver la Camiseta Imperial</a></p><p><strong>Plus Ultra.</strong></p></div>`,
    text: `Hola ${params.name}. Tu suscripción ${plan} está activa. Código: ${params.code}. ${TSHIRT_OFFER_COPY} Se aplica automáticamente al confirmar la compra, no al reservar. La compra se habilita el 12 de octubre de 2026. ${siteUrl}/tienda`,
  }, { idempotencyKey: `arcabucero-discount-${params.reference}` });
}

export async function sendPiqueroWelcomeEmail(params: {
  to: string;
  name?: string | null;
}) {
  const { to, name } = params;

  return resend.emails.send({
    from,
    replyTo: SITE.contactEmail,
    to,
    subject: "Tu cuenta PIQUERO esta activa",
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>${greeting(name)}</h1>
        <p>Tu cuenta <strong>PIQUERO</strong> esta activa.</p>
        <p>Ya formas parte del circulo de lectores y puedes acceder al contenido gratuito ampliado.</p>
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `${greeting(name)}. Tu cuenta PIQUERO esta activa. Ya formas parte del circulo de lectores y puedes acceder al contenido gratuito ampliado. Plus Ultra.`,
  });
}

export async function sendPaidWelcomeEmail(params: {
  to: string;
  name?: string | null;
  planName: "ARCABUCERO" | "MAESTRE DE CAMPO";
  priceSummary: string;
  termsVersion: string;
}) {
  const { to, name, planName, priceSummary, termsVersion } = params;
  const siteUrl = getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
  const copy = "Ya puedes leer todos los articulos para suscriptores, compartidos por Arcabucero y Maestre de Campo.";
  const offer = TSHIRT_OFFER_COPY;

  return resend.emails.send({
    from,
    replyTo: SITE.contactEmail,
    to,
    subject: `Tu suscripcion ${planName} esta activa`,
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>${greeting(name)}</h1>
        <p>Tu suscripcion <strong>${planName}</strong> esta activa.</p>
        <p><strong>Precio y periodicidad:</strong> ${priceSummary}.</p>
        <p>La suscripcion se renueva automaticamente hasta que la canceles desde tu cuenta antes de la siguiente renovacion.</p>
        <p>Terminos aceptados: version ${termsVersion}. Puedes consultarlos en <a href="${siteUrl}/legal/terminos">${siteUrl}/legal/terminos</a>.</p>
        <p>${copy}</p>
        ${offer ? `<p>${offer}</p>` : ""}
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `${greeting(name)}. Tu suscripcion ${planName} esta activa. Precio y periodicidad: ${priceSummary}. Se renueva automaticamente hasta que la canceles desde tu cuenta antes de la siguiente renovacion. Terminos aceptados: version ${termsVersion}, disponibles en ${siteUrl}/legal/terminos. ${copy} ${offer} Plus Ultra.`,
  });
}

export async function sendPaymentFailedEmail(params: { to: string }) {
  return resend.emails.send({
    from,
    replyTo: SITE.contactEmail,
    to: params.to,
    subject: "No hemos podido procesar tu pago",
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Problema con el pago</h1>
        <p>No hemos podido procesar el ultimo pago de tu suscripcion.</p>
        <p>Actualiza tu metodo de pago para mantener el acceso al archivo.</p>
      </div>
    `,
    text: "No hemos podido procesar el ultimo pago de tu suscripcion. Actualiza tu metodo de pago para mantener el acceso al archivo.",
  });
}

export async function sendSubscriptionCancelledEmail(params: { to: string }) {
  return resend.emails.send({
    from,
    replyTo: SITE.contactEmail,
    to: params.to,
    subject: "Tu suscripcion ha sido cancelada",
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Suscripcion cancelada</h1>
        <p>Tu suscripcion ha sido cancelada correctamente.</p>
        <p>Tu cuenta PIQUERO seguira disponible como acceso gratuito.</p>
      </div>
    `,
    text: "Tu suscripcion ha sido cancelada correctamente. Tu cuenta PIQUERO seguira disponible como acceso gratuito.",
  });
}

export async function sendMerchPurchaseEmail(params: {
  to: string;
  productName: string;
  size: string;
}) {
  const { to, productName, size } = params;
  const sizeCopy = size ? `, talla ${size}` : "";

  return resend.emails.send({
    from,
    replyTo: SITE.contactEmail,
    to,
    subject: "Hemos recibido tu pedido",
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Pedido confirmado</h1>
        <p>Hemos recibido el pago de <strong>${productName}${sizeCopy}</strong>.</p>
        <p>Prepararemos el pedido y te informaremos cuando salga hacia su destino.</p>
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `Pedido confirmado. Hemos recibido el pago de ${productName}${sizeCopy}. Prepararemos el pedido y te informaremos cuando salga hacia su destino. Plus Ultra.`,
  });
}
