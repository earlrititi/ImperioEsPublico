/** Customer message wording lives here; delivery, eligibility and retry state stay in their flows. */
import { prepareCorporateEmail } from "./corporate-email";
import { SITE } from "../config/site";
import { shirtOfferCopy } from "../config/tshirt-offer";

const from = `Imperio Espanol <${SITE.contactEmail}>`;

function greeting(name?: string | null) {
  return name ? `Bienvenido, ${name}` : "Bienvenido";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildTshirtDiscountEmail(
  params: {
    to: string;
    name: string;
    code: string;
    percent: number;
    reference: string;
  },
  siteUrl: string,
) {
  const name = escapeHtml(params.name);
  const code = escapeHtml(params.code);
  const plan = params.percent === 20 ? "Maestre de Campo" : "Arcabucero";
  const offer = shirtOfferCopy(
    params.percent === 20 ? "maestre_campo" : "arcabucero",
  );
  return {
    from,
    replyTo: SITE.contactEmail,
    to: params.to,
    subject: `Tu ${params.percent}% para la Camiseta Imperial`,
    html: `<div style="font-family:Georgia,serif;line-height:1.6;color:#111"><h1>Una pieza de nuestra historia</h1><p>Hola ${name},</p><p>Tu suscripción ${plan} está activa. Tu descuento del ${params.percent}% para la Camiseta Imperial está preparado.</p><p><strong>Código: ${code}</strong></p><p>${offer} Se aplica automáticamente al confirmar la compra, no al reservar. La compra se confirma en Stripe desde la tienda.</p><p><a href="${siteUrl}/tienda">Ver la Camiseta Imperial</a></p><p><strong>Plus Ultra.</strong></p></div>`,
    text: `Hola ${params.name}. Tu suscripción ${plan} está activa. Código: ${params.code}. ${offer} Se aplica automáticamente al confirmar la compra, no al reservar. La compra se confirma en Stripe desde la tienda. ${siteUrl}/tienda`,
  };
}

function buildPiqueroWelcomeEmail(params: {
  to: string;
  name?: string | null;
}) {
  const { to, name } = params;

  return {
    from,
    replyTo: SITE.contactEmail,
    to,
    subject: "Tu cuenta PIQUERO esta activa",
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>${escapeHtml(greeting(name))}</h1>
        <p>Tu cuenta <strong>PIQUERO</strong> esta activa.</p>
        <p>Ya formas parte del circulo de lectores y puedes acceder al contenido gratuito ampliado.</p>
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `${greeting(name)}. Tu cuenta PIQUERO esta activa. Ya formas parte del circulo de lectores y puedes acceder al contenido gratuito ampliado. Plus Ultra.`,
  };
}

function buildPaidWelcomeEmail(
  params: {
    to: string;
    name?: string | null;
    planName: "ARCABUCERO" | "MAESTRE DE CAMPO";
    priceSummary: string;
    termsVersion: string;
  },
  siteUrl: string,
) {
  const { to, name, planName, priceSummary, termsVersion } = params;
  const copy =
    "Ya puedes leer todos los articulos para suscriptores, compartidos por Arcabucero y Maestre de Campo.";
  const offer = shirtOfferCopy(
    params.planName === "MAESTRE DE CAMPO" ? "maestre_campo" : "arcabucero",
  );

  return {
    from,
    replyTo: SITE.contactEmail,
    to,
    subject: `Tu suscripcion ${planName} esta activa`,
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>${escapeHtml(greeting(name))}</h1>
        <p>Tu suscripcion <strong>${planName}</strong> esta activa.</p>
        <p><strong>Precio y periodicidad:</strong> ${escapeHtml(priceSummary)}.</p>
        <p>La suscripcion se renueva automaticamente hasta que la canceles desde tu cuenta antes de la siguiente renovacion.</p>
        <p>Terminos aceptados: version ${escapeHtml(termsVersion)}. Puedes consultarlos en <a href="${siteUrl}/legal/terminos">${siteUrl}/legal/terminos</a>.</p>
        <p>${copy}</p>
        ${offer ? `<p>${offer}</p>` : ""}
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `${greeting(name)}. Tu suscripcion ${planName} esta activa. Precio y periodicidad: ${priceSummary}. Se renueva automaticamente hasta que la canceles desde tu cuenta antes de la siguiente renovacion. Terminos aceptados: version ${termsVersion}, disponibles en ${siteUrl}/legal/terminos. ${copy} ${offer} Plus Ultra.`,
  };
}

function buildPaymentFailedEmail(params: { to: string }) {
  return {
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
  };
}

function buildSubscriptionCancelledEmail(params: { to: string }) {
  return {
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
  };
}

function buildMerchPurchaseEmail(params: {
  to: string;
  productName: string;
  size: string;
}) {
  const { to, productName, size } = params;
  const sizeCopy = size ? `, talla ${size}` : "";

  return {
    from,
    replyTo: SITE.contactEmail,
    to,
    subject: "Hemos recibido tu pedido",
    html: `
      <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
        <h1>Pedido confirmado</h1>
        <p>Hemos recibido el pago de <strong>${escapeHtml(productName)}${escapeHtml(sizeCopy)}</strong>.</p>
        <p>Tu compra se ha realizado correctamente. Comenzaremos a tramitar tu env&iacute;o a partir del 13 de octubre de 2026. Esta fecha corresponde al inicio de la tramitaci&oacute;n, no a la entrega.</p>
        <p><strong>Plus Ultra.</strong></p>
      </div>
    `,
    text: `Pedido confirmado. Hemos recibido el pago de ${productName}${sizeCopy}. Tu compra se ha realizado correctamente. Comenzaremos a tramitar tu env\u00edo a partir del 13 de octubre de 2026. Esta fecha corresponde al inicio de la tramitaci\u00f3n, no a la entrega. Plus Ultra.`,
  };
}

/** Existing customer messages; adding a type does not activate any delivery. */
export const customerMailCatalog = {
  tshirt_discount: buildTshirtDiscountEmail,
  piquero_welcome: buildPiqueroWelcomeEmail,
  paid_welcome: buildPaidWelcomeEmail,
  payment_failed: buildPaymentFailedEmail,
  subscription_cancelled: buildSubscriptionCancelledEmail,
  merch_purchase: buildMerchPurchaseEmail,
};

export type CustomerMailKind = keyof typeof customerMailCatalog;
export type CustomerMailParameters<K extends CustomerMailKind> = Parameters<
  (typeof customerMailCatalog)[K]
>;
type CustomerMailMessage = {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Pure rendering entry point: no provider, environment lookup, queue or network. */
export function renderCustomerMail<K extends CustomerMailKind>(
  kind: K,
  ...args: CustomerMailParameters<K>
) {
  const build = customerMailCatalog[kind] as (
    ...args: CustomerMailParameters<K>
  ) => CustomerMailMessage;
  return prepareCorporateEmail(build(...args));
}

/** Resend returns SDK errors as values as well as rejecting promises. Neither is an accepted delivery. */
export async function safeSendCustomerMail(
  sendEmail: () => Promise<unknown>,
  reportFailure: (error: unknown) => void,
) {
  try {
    const result = await sendEmail();
    if (
      !result ||
      typeof result !== "object" ||
      ("error" in result && result.error) ||
      !("data" in result) ||
      !result.data ||
      typeof result.data !== "object" ||
      !("id" in result.data) ||
      typeof result.data.id !== "string" ||
      !result.data.id
    ) {
      throw new Error("EMAIL_PROVIDER_UNAVAILABLE");
    }
    return true;
  } catch (error) {
    reportFailure(error);
    return false;
  }
}
