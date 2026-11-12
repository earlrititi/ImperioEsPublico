import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type Stripe from "stripe";
import { SITE } from "../config/site";
import {
  escapeEmailHtml,
  renderCorporateEmail,
  validateCorporateMessage,
} from "./corporate-email";
import {
  createCorporateMailClient,
  sendCorporateMail,
  type CorporateMailMessage,
  type CorporateMailResponse,
} from "./customer-mail-service";
import { assertMailRecipient, transactionalTestMessage } from "./mail-delivery";

/** Exact public snapshot event names. There is no PaymentMethod card-expiring event. */
export const STRIPE_CUSTOMER_MAIL_EVENTS = [
  "invoice.paid",
  "invoice.payment_succeeded",
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.finalized",
  "credit_note.created",
  "credit_note.updated",
  "credit_note.voided",
  "customer.subscription.trial_will_end",
  "invoice.upcoming",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.source.expiring",
] as const;
export type StripeCustomerMailEvent = Pick<
  Stripe.Event,
  "id" | "type" | "created" | "livemode"
> & {
  data: { object: unknown; previous_attributes?: unknown };
};
/** Deliberately exposes GET retrieval only; no create/update/cancel/refund/payment methods. */
export type StripeCustomerMailReadClient = {
  invoices: {
    retrieve(id: string, params?: { expand?: string[] }): Promise<unknown>;
  };
  checkout: {
    sessions: {
      retrieve(id: string, params?: { expand?: string[] }): Promise<unknown>;
    };
  };
  paymentIntents: {
    retrieve(id: string, params?: { expand?: string[] }): Promise<unknown>;
  };
  charges: { retrieve(id: string): Promise<unknown> };
  refunds: { retrieve(id: string): Promise<unknown> };
  subscriptions: {
    retrieve(id: string, params?: { expand?: string[] }): Promise<unknown>;
  };
  customers: {
    retrieve(id: string): Promise<unknown>;
    retrieveSource?(customer: string, source: string): Promise<unknown>;
  };
  creditNotes: { retrieve(id: string): Promise<unknown> };
};
type Data = Record<string, unknown>;
type Message = {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};
export type StripeCustomerMailRuntime = {
  enabled: boolean;
  starts_at: string | null;
  livemode: boolean;
};
type Guard = {
  resource:
    | "invoice"
    | "checkout"
    | "refund"
    | "subscription"
    | "credit_note"
    | "legacy_card";
  id: string;
  expected: string;
  customerId?: string;
  at?: number;
};
export type StripeCustomerMailPlan = {
  key: string;
  kind: string;
  guard: Guard;
  message: Message;
};
type Snapshot = { version: 1; guard: Guard; message: Message };
type Job = {
  id: string;
  key: string;
  claim_id: string;
  kind: string;
  recipient: string;
  subject: string;
  payload_digest: string;
  encrypted_message: string;
  livemode: boolean;
};
export type StripeCustomerMailDependencies = {
  runtime(): Promise<StripeCustomerMailRuntime>;
  rpc(name: string, args?: Record<string, unknown>): Promise<unknown>;
  secret(): string;
  transform(message: Message, runtime: StripeCustomerMailRuntime): Message;
  checkDelivery(message: Message, runtime: StripeCustomerMailRuntime): void;
  send(
    message: Message,
    key: string,
    kind: string,
  ): Promise<Pick<CorporateMailResponse, "data" | "error">>;
  now(): number;
};
const data = (value: unknown): Data =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Data)
    : {};
const str = (value: unknown) => (typeof value === "string" ? value : "");
const id = (value: unknown) =>
  str(typeof value === "string" ? value : data(value).id);
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const integer = (value: unknown) =>
  Number.isSafeInteger(value) ? (value as number) : null;
const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const clean = (value: unknown, length = 180) =>
  str(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, length);
const date = (seconds: unknown) => {
  const at = finite(seconds);
  if (at === null || !Number.isFinite(new Date(at * 1000).getTime())) return "";
  return new Date(at * 1000).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
  });
};
const identifier = (value: unknown) => {
  const result = id(value);
  if (!/^[A-Za-z0-9_]{1,180}$/.test(result))
    throw Error("STRIPE_MAIL_RESOURCE_INVALID");
  return result;
};
const email = (value: unknown) => {
  const result = str(value).trim().toLowerCase();
  return result.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(result)
    ? result
    : "";
};
const money = (amount: unknown, currency: unknown) => {
  const minor = integer(amount),
    code = str(currency).toUpperCase();
  if (minor === null || minor < 0 || !/^[A-Z]{3}$/.test(code))
    throw Error("STRIPE_MAIL_AMOUNT_INVALID");
  const format = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: code,
  });
  const digits = ["ISK", "UGX"].includes(code)
    ? 2
    : (format.resolvedOptions().maximumFractionDigits ?? 2);
  return format.format(minor / 10 ** digits);
};
function stripeUrl(value: unknown) {
  try {
    const url = new URL(str(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
function documents(object: Data, receipt?: unknown) {
  return [
    ["Ver recibo", stripeUrl(receipt)],
    ["Ver factura", stripeUrl(object.hosted_invoice_url)],
    ["Descargar factura (PDF)", stripeUrl(object.invoice_pdf)],
    ["Ver nota de crédito (PDF)", stripeUrl(object.pdf)],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]));
}
async function contact(
  object: Data,
  api: StripeCustomerMailReadClient,
  preferred?: unknown,
) {
  const direct =
    email(preferred) ||
    email(object.customer_email) ||
    email(data(object.customer_details).email) ||
    email(data(object.billing_details).email);
  if (direct)
    return {
      to: direct,
      name: clean(
        object.customer_name ||
          data(object.customer_details).name ||
          data(object.billing_details).name,
      ),
    };
  const customerId = id(object.customer);
  const customer = customerId
    ? data(await api.customers.retrieve(identifier(customerId)))
    : {};
  const to = customer.deleted === true ? "" : email(customer.email);
  if (!to) throw Error("STRIPE_MAIL_RECIPIENT_UNAVAILABLE");
  return { to, name: clean(customer.name) };
}
function compose(
  kind: string,
  identity: string,
  guard: Guard,
  recipient: { to: string; name: string },
  subject: string,
  paragraphs: string[],
  links: [string, string][] = [],
): StripeCustomerMailPlan {
  if (!/^[A-Za-z0-9_:-]{1,220}$/.test(identity))
    throw Error("STRIPE_MAIL_KEY_INVALID");
  const greeting = recipient.name ? "Hola " + recipient.name + "," : "Hola,";
  const account = SITE.url + "/cuenta";
  const support = "Soporte: " + SITE.contactEmail;
  const body = [greeting, ...paragraphs];
  const legalHtml =
    '<p><a href="' +
    SITE.url +
    '/legal/terminos">Términos y condiciones</a> · <a href="' +
    SITE.url +
    '/legal/privacidad">Privacidad</a> · <a href="' +
    SITE.url +
    '/legal/devoluciones">Devoluciones</a></p>';
  const legalText =
    "Condiciones: " +
    SITE.url +
    "/legal/terminos\nPrivacidad: " +
    SITE.url +
    "/legal/privacidad\nDevoluciones: " +
    SITE.url +
    "/legal/devoluciones";
  const rendered = renderCorporateEmail({
    subject,
    visualTitle: subject,
    bodyText:
      body.join("\n\n") +
      "\n\n" +
      links.map(([label, url]) => label + ": " + url).join("\n") +
      "\nGestionar tu cuenta: " +
      account +
      "\n" +
      support,
    bodyHtml:
      body.map((value) => "<p>" + escapeEmailHtml(value) + "</p>").join("") +
      links
        .map(
          ([label, url]) =>
            '<p><a href="' +
            escapeEmailHtml(url) +
            '">' +
            escapeEmailHtml(label) +
            "</a></p>",
        )
        .join("") +
      '<p><a href="' +
      account +
      '">Gestionar tu cuenta</a></p><p>' +
      escapeEmailHtml(support) +
      "</p>",
    legalHtml,
    legalText,
  });
  return {
    key: "stripe-mail:v1:" + identity,
    kind,
    guard,
    message: {
      from: "Imperio Español <" + SITE.contactEmail + ">",
      replyTo: SITE.contactEmail,
      to: recipient.to,
      subject,
      ...rendered,
    },
  };
}
const subscriptionId = (invoice: Data) =>
  id(data(data(invoice.parent).subscription_details).subscription) ||
  id(invoice.subscription);
const items = (subscription: Data): Data[] => {
  const values = data(subscription.items).data;
  return Array.isArray(values) ? values.map(data) : [];
};
const periodEnd = (subscription: Data) => {
  const values = [
    integer(subscription.current_period_end),
    ...items(subscription).map((item) => integer(item.current_period_end)),
  ].filter((value): value is number => value !== null && value > 0);
  return values.length ? Math.min(...values) : null;
};
const cancellationAt = (subscription: Data) =>
  integer(subscription.cancel_at) ||
  (subscription.cancel_at_period_end === true ? periodEnd(subscription) : null);
const isOpenInvoice = (invoice: Data) =>
  invoice.status === "open" && (finite(invoice.amount_remaining) ?? 0) > 0;

/** Prepares prospective content only; never sends, writes, authenticates a user or mutates Stripe. */
export async function planStripeCustomerMail(
  event: StripeCustomerMailEvent,
  api: StripeCustomerMailReadClient,
  now = Date.now(),
): Promise<StripeCustomerMailPlan[]> {
  if (!(STRIPE_CUSTOMER_MAIL_EVENTS as readonly string[]).includes(event.type))
    return [];
  const object = data(event.data.object),
    nowSeconds = Math.floor(now / 1000);
  if (
    [
      "invoice.paid",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "invoice.payment_action_required",
      "invoice.finalized",
    ].includes(event.type)
  ) {
    const invoiceId = identifier(object.id),
      invoice = data(await api.invoices.retrieve(invoiceId));
    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_succeeded"
    ) {
      if (invoice.status !== "paid") return [];
      const links = documents(invoice);
      if (!links.length) throw Error("STRIPE_MAIL_DOCUMENT_UNAVAILABLE");
      return [
        compose(
          "invoice_paid",
          "invoice_paid:" + invoiceId,
          { resource: "invoice", id: invoiceId, expected: "paid" },
          await contact(invoice, api),
          "Tu factura está pagada",
          [
            "Hemos registrado el pago de la factura " +
              clean(invoice.number || invoiceId) +
              ".",
            "Importe abonado: " +
              money(invoice.amount_paid, invoice.currency) +
              ".",
            "Este aviso confirma el estado de la factura; puedes consultar el documento original de Stripe.",
          ],
          links,
        ),
      ];
    }
    if (!isOpenInvoice(invoice)) return [];
    if (
      event.type === "invoice.finalized" &&
      invoice.collection_method !== "send_invoice"
    )
      return [];
    const kind =
      event.type === "invoice.payment_failed"
        ? "invoice_payment_failed"
        : event.type === "invoice.payment_action_required"
          ? "invoice_action_required"
          : "invoice_awaiting_payment";
    const url = stripeUrl(invoice.hosted_invoice_url);
    if (!url) throw Error("STRIPE_MAIL_DOCUMENT_UNAVAILABLE");
    const subject =
      kind === "invoice_payment_failed"
        ? "No se ha completado el pago de tu factura"
        : kind === "invoice_action_required"
          ? "Tu pago requiere confirmación"
          : "Tu factura está disponible para pagar";
    const instructions =
      kind === "invoice_action_required"
        ? "Abre la página segura de Stripe para completar la confirmación que solicite tu banco, incluida 3D Secure cuando corresponda. No compartas códigos de seguridad por correo."
        : kind === "invoice_payment_failed"
          ? "Puedes revisar el estado y actualizar el método de pago en Stripe. Este correo no inicia ningún cargo."
          : "Revisa la factura y sus instrucciones de pago en Stripe.";
    const attempt = integer(invoice.attempt_count) ?? 0;
    return [
      compose(
        kind,
        kind +
          ":" +
          invoiceId +
          (kind === "invoice_awaiting_payment" ? "" : ":" + attempt),
        { resource: "invoice", id: invoiceId, expected: "open" },
        await contact(invoice, api),
        subject,
        [
          "Factura: " +
            clean(invoice.number || invoiceId) +
            ". Pendiente: " +
            money(invoice.amount_remaining, invoice.currency) +
            ".",
          instructions,
        ],
        [["Consultar factura y completar el pago", url]],
      ),
    ];
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const checkoutId = identifier(object.id),
      session = data(await api.checkout.sessions.retrieve(checkoutId));
    if (
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      id(session.invoice)
    )
      return [];
    if (!id(session.payment_intent)) return [];
    const paymentId = identifier(session.payment_intent),
      intent = data(
        await api.paymentIntents.retrieve(paymentId, {
          expand: ["latest_charge"],
        }),
      );
    const chargeId = identifier(intent.latest_charge),
      charge =
        typeof intent.latest_charge === "object"
          ? data(intent.latest_charge)
          : data(await api.charges.retrieve(chargeId));
    if (
      intent.status !== "succeeded" ||
      charge.paid !== true ||
      charge.captured === false
    )
      return [];
    const receipt = stripeUrl(charge.receipt_url);
    if (!receipt) throw Error("STRIPE_MAIL_DOCUMENT_UNAVAILABLE");
    const recipient = await contact(
      session,
      api,
      email(data(charge.billing_details).email),
    );
    return [
      compose(
        "checkout_paid",
        "checkout_paid:" + paymentId,
        { resource: "checkout", id: checkoutId, expected: "paid" },
        recipient,
        "Hemos recibido tu pago",
        [
          "Importe recibido: " +
            money(charge.amount_captured ?? charge.amount, charge.currency) +
            ".",
          "Puedes consultar el recibo original y su estado actualizado en Stripe. La preparación y el envío del pedido se comunican por separado.",
        ],
        [["Ver recibo", receipt]],
      ),
    ];
  }
  if (
    ["refund.created", "refund.updated", "refund.failed"].includes(event.type)
  ) {
    const refundId = identifier(object.id),
      refund = data(await api.refunds.retrieve(refundId));
    const status = str(refund.status);
    if (
      ![
        "pending",
        "requires_action",
        "succeeded",
        "failed",
        "canceled",
      ].includes(status) ||
      refund.reason === "expired_uncaptured_charge"
    )
      return [];
    const charge = data(await api.charges.retrieve(identifier(refund.charge)));
    if (charge.captured === false || (finite(refund.amount) ?? 0) <= 0)
      return [];
    const kind = "refund_" + status,
      title =
        status === "succeeded"
          ? "Tu reembolso ha sido confirmado"
          : status === "pending"
            ? "Tu reembolso está en trámite"
            : status === "requires_action"
              ? "Tu reembolso requiere atención"
              : "Tu reembolso no se ha completado";
    const copy =
      status === "succeeded"
        ? "Stripe ha confirmado el reembolso. El plazo para verlo reflejado depende de tu banco o método de pago."
        : status === "pending"
          ? "El reembolso sigue pendiente de confirmación. Este aviso no confirma que el dinero haya llegado a tu cuenta."
          : status === "requires_action"
            ? "El método de pago requiere información adicional. Contacta con soporte y conserva los avisos de instrucciones enviados por Stripe. No compartas contraseñas ni códigos por correo."
            : "El reembolso no se ha completado. Contacta con soporte para revisar el estado.";
    return [
      compose(
        kind,
        "refund:" + refundId + ":" + status,
        { resource: "refund", id: refundId, expected: status },
        await contact(charge, api),
        title,
        [
          "Referencia: " +
            refundId +
            ". Importe: " +
            money(refund.amount, refund.currency) +
            ".",
          copy,
        ],
        documents({}, charge.receipt_url),
      ),
    ];
  }
  if (
    [
      "credit_note.created",
      "credit_note.updated",
      "credit_note.voided",
    ].includes(event.type)
  ) {
    const noteId = identifier(object.id),
      note = data(await api.creditNotes.retrieve(noteId)),
      status = str(note.status);
    if (!["issued", "void"].includes(status)) return [];
    const invoice = data(await api.invoices.retrieve(identifier(note.invoice))),
      links = documents(note);
    if (status === "issued" && !links.length)
      throw Error("STRIPE_MAIL_DOCUMENT_UNAVAILABLE");
    return [
      compose(
        "credit_note_" + status,
        "credit_note:" + noteId + ":" + status,
        { resource: "credit_note", id: noteId, expected: status },
        await contact(invoice, api),
        status === "issued"
          ? "Tu nota de crédito está disponible"
          : "Tu nota de crédito ha sido anulada",
        [
          "Referencia: " +
            clean(note.number || noteId) +
            ". Importe: " +
            money(note.amount, note.currency) +
            ".",
          status === "issued"
            ? "Consulta el documento original de Stripe. Una nota de crédito no confirma por sí sola un reembolso bancario."
            : "La nota de crédito está anulada. Consulta soporte si necesitas aclaraciones.",
        ],
        links,
      ),
    ];
  }
  if (event.type === "invoice.upcoming") {
    const subId = subscriptionId(object);
    if (!subId) return [];
    const subscription = data(
        await api.subscriptions.retrieve(identifier(subId)),
      ),
      at = periodEnd(subscription);
    if (
      !at ||
      at <= nowSeconds ||
      subscription.collection_method !== "charge_automatically" ||
      subscription.cancel_at_period_end === true ||
      cancellationAt(subscription) ||
      !["active", "trialing"].includes(str(subscription.status))
    )
      return [];
    return [
      compose(
        "subscription_upcoming",
        "subscription_upcoming:" + subId + ":" + at,
        { resource: "subscription", id: subId, expected: "upcoming", at },
        await contact(object, api),
        "Tu próxima renovación",
        [
          "Tu suscripción tiene prevista su próxima renovación el " +
            date(at) +
            ".",
          "Importe estimado comunicado por Stripe: " +
            money(object.amount_due, object.currency) +
            ". La factura definitiva puede reflejar ajustes.",
          "Puedes gestionar la suscripción desde tu cuenta antes de la renovación.",
        ],
      ),
    ];
  }
  if (
    [
      "customer.subscription.trial_will_end",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)
  ) {
    const subId = identifier(object.id),
      subscription = data(
        await api.subscriptions.retrieve(subId, { expand: ["latest_invoice"] }),
      );
    const recipient = () => contact(subscription, api);
    if (event.type === "customer.subscription.trial_will_end") {
      const at = integer(subscription.trial_end);
      if (subscription.status !== "trialing" || !at || at <= nowSeconds)
        return [];
      return [
        compose(
          "subscription_trial_ending",
          "subscription_trial_ending:" + subId + ":" + at,
          { resource: "subscription", id: subId, expected: "trialing", at },
          await recipient(),
          "Tu periodo de prueba está próximo a terminar",
          [
            "El periodo de prueba termina el " + date(at) + ".",
            "Revisa las condiciones y el método de pago desde tu cuenta. El cobro, cuando corresponda, seguirá las condiciones de tu suscripción.",
          ],
        ),
      ];
    }
    if (event.type === "customer.subscription.deleted") {
      if (subscription.status !== "canceled") return [];
      return [
        compose(
          "subscription_cancelled",
          "subscription_cancelled:" + subId,
          { resource: "subscription", id: subId, expected: "canceled" },
          await recipient(),
          "Tu suscripción ha finalizado",
          [
            "La suscripción ha finalizado. Puedes consultar el estado de tu cuenta y tus documentos de pago desde tu cuenta.",
          ],
        ),
      ];
    }
    const previous = data(event.data.previous_attributes),
      at = cancellationAt(subscription);
    const transitioned =
      (Object.hasOwn(previous, "cancel_at_period_end") &&
        previous.cancel_at_period_end !== subscription.cancel_at_period_end) ||
      (Object.hasOwn(previous, "cancel_at") &&
        previous.cancel_at !== subscription.cancel_at);
    if (
      !transitioned ||
      !at ||
      at <= nowSeconds ||
      subscription.status === "canceled"
    )
      return [];
    return [
      compose(
        "subscription_cancel_scheduled",
        "subscription_cancel_scheduled:" + subId + ":" + at,
        {
          resource: "subscription",
          id: subId,
          expected: "cancel_scheduled",
          at,
        },
        await recipient(),
        "La cancelación de tu suscripción está programada",
        [
          "La cancelación está prevista para el " + date(at) + ".",
          "La suscripción aún no ha finalizado. Puedes consultar su estado y las opciones disponibles desde tu cuenta.",
        ],
      ),
    ];
  }
  if (event.type === "customer.source.expiring") {
    const customerId = identifier(object.customer),
      sourceId = identifier(object.id);
    if (!api.customers.retrieveSource)
      throw Error("STRIPE_MAIL_SOURCE_READER_REQUIRED");
    const source = data(
        await api.customers.retrieveSource(customerId, sourceId),
      ),
      card = source.object === "card" ? source : data(source.card);
    const year = integer(card.exp_year),
      month = integer(card.exp_month);
    if (!year || !month || month < 1 || month > 12) return [];
    const at = Math.floor(Date.UTC(year, month, 1) / 1000);
    if (at <= nowSeconds || at > nowSeconds + 45 * 86400) return [];
    return [
      compose(
        "legacy_card_expiring",
        "legacy_card_expiring:" + sourceId + ":" + year + ":" + month,
        {
          resource: "legacy_card",
          id: sourceId,
          customerId,
          expected: year + ":" + month,
          at,
        },
        await contact({ customer: customerId }, api),
        "Tu tarjeta está próxima a caducar",
        [
          "La tarjeta asociada a tu cliente de Stripe caduca al finalizar el mes " +
            month +
            "/" +
            year +
            ".",
          "Puedes revisar el método de pago desde tu cuenta. No envíes los datos de la tarjeta por correo.",
        ],
      ),
    ];
  }
  return [];
}
function cipherKey(secret: string) {
  if (secret.length < 32) throw Error("STRIPE_MAIL_SECRET_REQUIRED");
  return createHash("sha256")
    .update("stripe-customer-mail-key:v1\0" + secret)
    .digest();
}
function seal(snapshot: Snapshot, businessKey: string, secret: string) {
  const plain = Buffer.from(JSON.stringify(snapshot));
  if (plain.length > 512 * 1024) throw Error("STRIPE_MAIL_SNAPSHOT_INVALID");
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", cipherKey(secret), nonce);
  cipher.setAAD(Buffer.from("stripe-customer-mail-aad:v1\0" + businessKey));
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return (
    "v1." +
    Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64")
  );
}
function unseal(value: string, businessKey: string, secret: string): Snapshot {
  try {
    if (!/^v1\.[A-Za-z0-9+/=]+$/.test(value) || value.length > 1048576)
      throw Error();
    const bytes = Buffer.from(value.slice(3), "base64");
    if (bytes.length < 29) throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cipherKey(secret),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from("stripe-customer-mail-aad:v1\0" + businessKey));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const snapshot = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      snapshot.version !== 1 ||
      ![
        "invoice",
        "checkout",
        "refund",
        "subscription",
        "credit_note",
        "legacy_card",
      ].includes(snapshot.guard?.resource)
    )
      throw Error();
    return snapshot;
  } catch {
    throw Error("STRIPE_MAIL_SNAPSHOT_INVALID");
  }
}
async function stillEligible(
  guard: Guard,
  api: StripeCustomerMailReadClient,
  now: number,
) {
  if (guard.resource === "invoice") {
    const invoice = data(await api.invoices.retrieve(identifier(guard.id)));
    return guard.expected === "paid"
      ? invoice.status === "paid"
      : isOpenInvoice(invoice);
  }
  if (guard.resource === "checkout")
    return (
      data(await api.checkout.sessions.retrieve(identifier(guard.id)))
        .payment_status === "paid"
    );
  if (guard.resource === "refund")
    return (
      data(await api.refunds.retrieve(identifier(guard.id))).status ===
      guard.expected
    );
  if (guard.resource === "credit_note")
    return (
      data(await api.creditNotes.retrieve(identifier(guard.id))).status ===
      guard.expected
    );
  if (guard.resource === "subscription") {
    const subscription = data(
        await api.subscriptions.retrieve(identifier(guard.id)),
      ),
      seconds = now / 1000;
    if (guard.expected === "canceled")
      return subscription.status === "canceled";
    if (!guard.at || guard.at <= seconds) return false;
    if (guard.expected === "trialing")
      return (
        subscription.status === "trialing" &&
        subscription.trial_end === guard.at
      );
    if (guard.expected === "cancel_scheduled")
      return (
        subscription.status !== "canceled" &&
        cancellationAt(subscription) === guard.at
      );
    return (
      ["active", "trialing"].includes(str(subscription.status)) &&
      subscription.collection_method === "charge_automatically" &&
      !cancellationAt(subscription) &&
      periodEnd(subscription) === guard.at
    );
  }
  if (
    !api.customers.retrieveSource ||
    !guard.customerId ||
    !guard.at ||
    guard.at <= now / 1000
  )
    return false;
  const source = data(
      await api.customers.retrieveSource(
        identifier(guard.customerId),
        identifier(guard.id),
      ),
    ),
    card = source.object === "card" ? source : data(source.card);
  return guard.expected === card.exp_year + ":" + card.exp_month;
}
function dependencies(
  overrides: Partial<StripeCustomerMailDependencies>,
): StripeCustomerMailDependencies {
  const runtime: StripeCustomerMailDependencies["runtime"] = async () => {
    const { database } = await import("./reservations");
    const result = await (await database())
      .from("stripe_customer_mail_runtime")
      .select("enabled,starts_at,livemode")
      .eq("id", true)
      .maybeSingle();
    if (result.error) {
      if (["42P01", "PGRST205"].includes(result.error.code))
        return { enabled: false, starts_at: null, livemode: true };
      throw Error("STRIPE_MAIL_RUNTIME_UNAVAILABLE");
    }
    return result.data ?? { enabled: false, starts_at: null, livemode: true };
  };
  const mode = async () => {
    const { getRequiredEnv } = await import("./env");
    return getRequiredEnv("STRIPE_SECRET_KEY");
  };
  let client: ReturnType<typeof createCorporateMailClient> | undefined;
  return {
    runtime,
    rpc: async (name, args) => (await import("./reservations")).rpc(name, args),
    secret: () => {
      const value =
        import.meta.env?.RESERVATION_TOKEN_SECRET ??
        process.env.RESERVATION_TOKEN_SECRET ??
        "";
      if (!value) throw Error("STRIPE_MAIL_SECRET_REQUIRED");
      return value;
    },
    transform: (message, active) => {
      const key =
        import.meta.env?.STRIPE_SECRET_KEY ??
        process.env.STRIPE_SECRET_KEY ??
        "";
      const recipient =
        import.meta.env?.TRANSACTIONAL_EMAIL_TEST_RECIPIENT ??
        process.env.TRANSACTIONAL_EMAIL_TEST_RECIPIENT ??
        "";
      if (
        /^(sk|rk)_live_/.test(key) !== active.livemode ||
        !/^(sk|rk)_(live|test)_/.test(key)
      )
        throw Error("STRIPE_MAIL_MODE_MISMATCH");
      if (!active.livemode && !recipient)
        throw Error("STRIPE_MAIL_TEST_RECIPIENT_REQUIRED");
      return transactionalTestMessage(
        message,
        recipient,
        key,
        import.meta.env?.TRANSACTIONAL_EMAIL_TEST_RUN_ID ??
          process.env.TRANSACTIONAL_EMAIL_TEST_RUN_ID ??
          "",
      );
    },
    checkDelivery: (message, active) => {
      const key =
        import.meta.env?.STRIPE_SECRET_KEY ??
        process.env.STRIPE_SECRET_KEY ??
        "";
      const recipient =
        import.meta.env?.TRANSACTIONAL_EMAIL_TEST_RECIPIENT ??
        process.env.TRANSACTIONAL_EMAIL_TEST_RECIPIENT ??
        "";
      if (
        /^(sk|rk)_live_/.test(key) !== active.livemode ||
        !/^(sk|rk)_(live|test)_/.test(key)
      )
        throw Error("STRIPE_MAIL_MODE_MISMATCH");
      if (active.livemode && recipient)
        throw Error("STRIPE_MAIL_MODE_MISMATCH");
      if (!active.livemode) assertMailRecipient(message, "test", recipient);
    },
    send: async (message, key, kind) => {
      await mode();
      const { getRequiredEnv } = await import("./env");
      client ??= createCorporateMailClient(getRequiredEnv("RESEND_API_KEY"));
      return sendCorporateMail(
        client,
        message as CorporateMailMessage,
        { idempotencyKey: key },
        { preserveSnapshot: true, flow: "stripe", stage: kind },
      );
    },
    now: Date.now,
    ...overrides,
  };
}
function activeFor(runtime: StripeCustomerMailRuntime, now: number) {
  const start = runtime.starts_at ? Date.parse(runtime.starts_at) : NaN;
  return runtime.enabled === true && Number.isFinite(start) && start <= now;
}

export async function stripeCustomerMailActiveForEvent(
  event: StripeCustomerMailEvent,
  overrides: Partial<StripeCustomerMailDependencies> = {},
) {
  const deps = dependencies(overrides);
  const runtime = await deps.runtime();
  const now = deps.now();
  return (
    activeFor(runtime, now) &&
    event.livemode === runtime.livemode &&
    Number.isSafeInteger(event.created) &&
    event.created * 1000 >= Date.parse(runtime.starts_at!) &&
    event.created * 1000 <= now + 300000
  );
}

/** Call before completeStripeEvent. Enqueue failure must propagate so Stripe can retry. */
export async function queueStripeCustomerMail(
  event: StripeCustomerMailEvent,
  api: StripeCustomerMailReadClient,
  overrides: Partial<StripeCustomerMailDependencies> = {},
) {
  const deps = dependencies(overrides),
    runtime = await deps.runtime(),
    now = deps.now();
  if (!activeFor(runtime, now))
    return {
      enabled: false,
      enqueued: 0,
      planned: 0,
      kinds: [] as string[],
      reason: "disabled",
    };
  if (
    event.livemode !== runtime.livemode ||
    !Number.isSafeInteger(event.created) ||
    event.created * 1000 < Date.parse(runtime.starts_at!) ||
    event.created * 1000 > now + 300000
  )
    return {
      enabled: true,
      enqueued: 0,
      planned: 0,
      kinds: [] as string[],
      reason: "outside_scope",
    };
  if (!/^evt_[A-Za-z0-9_]{1,180}$/.test(event.id))
    throw Error("STRIPE_MAIL_EVENT_INVALID");
  const plans = await planStripeCustomerMail(event, api, now);
  let enqueued = 0;
  for (const plan of plans) {
    const message = deps.transform(plan.message, runtime);
    validateCorporateMessage(message);
    const snapshot: Snapshot = { version: 1, guard: plan.guard, message };
    const result = await deps.rpc("enqueue_stripe_customer_mail", {
      p_key: plan.key,
      p_event_id: event.id,
      p_event_type: event.type,
      p_event_created_at: new Date(event.created * 1000).toISOString(),
      p_livemode: event.livemode,
      p_kind: plan.kind,
      p_recipient: message.to,
      p_subject: message.subject,
      p_payload_digest: sha(JSON.stringify(snapshot)),
      p_encrypted_message: seal(snapshot, plan.key, deps.secret()),
    });
    if (result === true) enqueued++;
    else if (result !== false) throw Error("STRIPE_MAIL_ENQUEUE_UNCONFIRMED");
  }
  return {
    enabled: true,
    enqueued,
    planned: plans.length,
    kinds: plans.map((plan) => plan.kind),
    reason: plans.length ? "queued_or_duplicate" : "not_applicable",
  };
}

/** Poll independently of webhook redeliveries; no send is possible while the runtime is disabled. */
export async function drainStripeCustomerMail(
  limit: number,
  api: StripeCustomerMailReadClient,
  overrides: Partial<StripeCustomerMailDependencies> = {},
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25)
    throw Error("INVALID_INPUT");
  const deps = dependencies(overrides);
  let sent = 0,
    suppressed = 0,
    failed = 0,
    review = 0;
  if (!activeFor(await deps.runtime(), deps.now()))
    return { enabled: false, sent, suppressed, failed, review };
  for (let index = 0; index < limit; index++) {
    const claimed = await deps.rpc("claim_stripe_customer_mail"),
      row = Array.isArray(claimed)
        ? (claimed[0] as Job | undefined)
        : undefined;
    if (!row) break;
    let fatal = false;
    try {
      const snapshot = unseal(row.encrypted_message, row.key, deps.secret());
      if (
        sha(JSON.stringify(snapshot)) !== row.payload_digest ||
        snapshot.message.to !== row.recipient ||
        snapshot.message.subject !== row.subject ||
        !email(snapshot.message.to) ||
        snapshot.message.from !==
          "Imperio Español <" + SITE.contactEmail + ">" ||
        snapshot.message.replyTo !== SITE.contactEmail ||
        "cc" in snapshot.message ||
        "bcc" in snapshot.message
      )
        throw Error("STRIPE_MAIL_SNAPSHOT_INVALID");
      validateCorporateMessage(snapshot.message);
      const runtime = await deps.runtime();
      if (
        !activeFor(runtime, deps.now()) ||
        runtime.livemode !== row.livemode ||
        !(await stillEligible(snapshot.guard, api, deps.now()))
      ) {
        if (
          (await deps.rpc("suppress_stripe_customer_mail", {
            p_id: row.id,
            p_claim: row.claim_id,
            p_code: "STATE_CHANGED",
          })) !== true
        )
          throw Error("STRIPE_MAIL_CLAIM_LOST");
        suppressed++;
        continue;
      }
      deps.checkDelivery(snapshot.message, runtime);
      if (
        (await deps.rpc("stripe_customer_mail_can_send", {
          p_id: row.id,
          p_claim: row.claim_id,
        })) !== true
      )
        throw Error("STRIPE_MAIL_CLAIM_LOST");
      const response = await deps.send(snapshot.message, row.key, row.kind);
      if (response.error || !response.data?.id)
        throw Error("STRIPE_MAIL_PROVIDER_NOT_ACCEPTED");
      if (
        (await deps.rpc("complete_stripe_customer_mail", {
          p_id: row.id,
          p_claim: row.claim_id,
          p_provider: response.data.id,
        })) !== true
      )
        throw Error("STRIPE_MAIL_ACK_UNCERTAIN");
      sent++;
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message)
          ? error.message
          : "STRIPE_MAIL_RETRY_PENDING";
      fatal = [
        "STRIPE_MAIL_SNAPSHOT_INVALID",
        "STRIPE_MAIL_MODE_MISMATCH",
        "EMAIL_TEST_RECIPIENT_MISMATCH",
      ].includes(code);
      if (
        (await deps.rpc("fail_stripe_customer_mail", {
          p_id: row.id,
          p_claim: row.claim_id,
          p_code: code,
          p_retry: !fatal,
        })) !== true
      )
        throw Error("STRIPE_MAIL_ACK_UNCERTAIN");
      if (fatal) review++;
      else failed++;
    }
  }
  return { enabled: true, sent, suppressed, failed, review };
}
