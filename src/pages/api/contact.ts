import type { APIRoute } from "astro";
import { SITE } from "../../config/site";
import { consumeRateLimit } from "../../lib/rate-limit";
import { isAllowedRequestOrigin } from "../../lib/request-security";

export const prerender = false;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ redirect, request }) => {
  const isJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const fail = (message: string, status = 400, destination = "/contacto?error=1") =>
    isJson ? json({ ok: false, error: message }, status) : redirect(destination, 303);

  if (!isAllowedRequestOrigin(request, import.meta.env.PUBLIC_SITE_URL)) {
    return fail("Origen no permitido", 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32768) {
    return fail("Solicitud demasiado grande", 413);
  }

  try {
    const allowed = await consumeRateLimit({
      request,
      endpoint: "contact",
      limit: 5,
      windowSeconds: 15 * 60,
    });

    if (!allowed) {
      return fail("Demasiadas solicitudes. Intentalo mas tarde.", 429);
    }
  } catch {
    return fail("El formulario no esta disponible temporalmente.", 503);
  }

  const raw = isJson
    ? await request.json().catch(() => ({}))
    : Object.fromEntries(await request.formData());
  const requestType = clean(raw.requestType, 30) === "withdrawal" ? "withdrawal" : "contact";
  const firstName = clean(raw.firstName ?? raw.nombre, 80);
  const lastName = clean(raw.lastName ?? raw.apellidos, 80);
  const fullName = clean(raw.fullName, 160) || `${firstName} ${lastName}`.trim();
  const email = clean(raw.email ?? raw.correo, 254).toLowerCase();
  const subject = clean(raw.subject ?? raw.tema, 160);
  const message = clean(raw.message ?? raw.mensaje, 5000);
  const company = clean(raw.company, 120);
  const privacyAcknowledged = raw.privacyAcknowledged === "on" || raw.privacyAcknowledged === true;
  const orderReference = clean(raw.orderReference, 100);
  const contractDate = clean(raw.contractDate, 20);
  const destination = requestType === "withdrawal"
    ? "/legal/desistimiento?error=1"
    : "/contacto?error=1";

  if (company) {
    return isJson
      ? json({ ok: true }, 200)
      : redirect(requestType === "withdrawal" ? "/legal/desistimiento?sent=1" : "/contacto?sent=1", 303);
  }

  if (
    !fullName ||
    !EMAIL_PATTERN.test(email) ||
    !subject ||
    !message ||
    (requestType === "contact" && !privacyAcknowledged) ||
    (requestType === "withdrawal" && (!orderReference || !contractDate))
  ) {
    return fail("Revisa los campos obligatorios.", 400, destination);
  }

  const escapedName = escapeHtml(fullName);
  const escapedEmail = escapeHtml(email);
  const escapedSubject = escapeHtml(subject);
  const escapedMessage = escapeHtml(message).replaceAll("\n", "<br />");
  const from = `Imperio Espanol <${SITE.contactEmail}>`;
  const { resend } = await import("../../lib/resend");
  const ownerSubject = requestType === "withdrawal"
    ? `Desistimiento: ${subject}`
    : `Contacto web: ${subject}`;
  const details = requestType === "withdrawal"
    ? `<p><strong>Referencia:</strong> ${escapeHtml(orderReference)}</p><p><strong>Fecha:</strong> ${escapeHtml(contractDate)}</p>`
    : "";
  const result = await resend.emails.send({
    from,
    to: SITE.contactEmail,
    replyTo: email,
    subject: ownerSubject,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><p><strong>Nombre:</strong> ${escapedName}</p><p><strong>Email:</strong> ${escapedEmail}</p>${details}<p><strong>Asunto:</strong> ${escapedSubject}</p><p><strong>Mensaje:</strong><br>${escapedMessage}</p></div>`,
    text: `Nombre: ${fullName}\nEmail: ${email}\n${requestType === "withdrawal" ? `Referencia: ${orderReference}\nFecha: ${contractDate}\n` : ""}Asunto: ${subject}\nMensaje:\n${message}`,
  });

  if (result.error) {
    console.error("Contact delivery failed:", result.error);
    return fail("No se pudo enviar la solicitud.", 502, destination);
  }

  if (requestType === "withdrawal") {
    const confirmation = await resend.emails.send({
      from,
      to: email,
      subject: "Hemos recibido tu comunicacion de desistimiento",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><p>Hola ${escapedName},</p><p>Hemos recibido tu comunicacion relativa a la referencia <strong>${escapeHtml(orderReference)}</strong>.</p><p>Fecha indicada: ${escapeHtml(contractDate)}.</p><p>Conserva este correo como acuse de recepcion.</p></div>`,
      text: `Hola ${fullName}. Hemos recibido tu comunicacion relativa a la referencia ${orderReference}. Fecha indicada: ${contractDate}. Conserva este correo como acuse de recepcion.`,
    });

    if (confirmation.error) {
      console.error("Withdrawal confirmation failed:", confirmation.error);
    }
  }

  if (isJson) {
    return json({ ok: true }, 200);
  }

  return redirect(
    requestType === "withdrawal" ? "/legal/desistimiento?sent=1" : "/contacto?sent=1",
    303
  );
};
