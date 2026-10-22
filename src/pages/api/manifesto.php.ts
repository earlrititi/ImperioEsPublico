import type { APIRoute } from "astro";
import { SITE } from "../../config/site";
import { LEGAL_DOCUMENT_VERSIONS } from "../../config/legal";
import { getRequiredEnv } from "../../lib/env";
import { recordLegalConsents } from "../../lib/legal-consents";
import { consumeRateLimit } from "../../lib/rate-limit";
import { isAllowedRequestOrigin } from "../../lib/request-security";
import { notifyLead } from "../../lib/lead-notifications";
import {database,optionalEnv} from "../../lib/reservations";
import { EMAIL_MARKETING_CONSENT, EMAIL_MARKETING_COPY_VERSION, NEWSLETTER_PDF_PATH } from "../../config/email-marketing";
import { unsubscribeToken } from "../../lib/admin-mail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const prerender = false;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function siteUrl() {
  return getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
}

function safeName(input: unknown) {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, 80);
}

function safeSource(input: unknown) {
  if (typeof input !== "string") {
    return "web";
  }

  return input.trim().slice(0, 40) || "web";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const POST: APIRoute = async ({ request }) => {
  const nativeForm = request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded");
  const respond = (body: Record<string, unknown>, status = 200) => nativeForm && !request.headers.get("accept")?.includes("application/json")
    ? new Response(null, {status:303,headers:{Location:body.ok ? "/newsletter?sent=1" : "/newsletter?error=1","Cache-Control":"no-store"}})
    : jsonResponse(body,status);
  try {
    const publicSiteUrl = siteUrl();

    if (!isAllowedRequestOrigin(request, publicSiteUrl)) {
      return respond({ ok: false, error: "Origen no permitido." }, 403);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > 8192) {
      return respond({ ok: false, error: "Solicitud demasiado grande." }, 413);
    }

    const allowed = await consumeRateLimit({
      request,
      endpoint: "manifesto",
      limit: 4,
      windowSeconds: 15 * 60,
    });

    if (!allowed) {
      return respond(
        { ok: false, error: "Demasiadas solicitudes. Intentalo mas tarde." },
        429
      );
    }

    if (!nativeForm && !request.headers.get("content-type")?.startsWith("application/json")) return respond({ok:false,error:"Formato no permitido."},415);
    // Enforce the limit even when Content-Length is missing or inaccurate.
    const reader=request.body?.getReader();let size=0;let raw="";const decoder=new TextDecoder();
    if(reader){while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>8192){await reader.cancel();return respond({ok:false,error:"Solicitud demasiado grande."},413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}
    const form = nativeForm ? new URLSearchParams(raw) : null;
    const body = form ? {...Object.fromEntries(form),resource:"seven_stories",source:"newsletter_page",
      privacyAcknowledged:form.get("intent")==="newsletter_pdf",marketingConsent:form.get("intent")==="newsletter_pdf",consentAction:form.get("intent")}
      : (()=>{try{return JSON.parse(raw);}catch{return null;}})();

    if (!body || typeof body !== "object") {
      return respond({ ok: false, error: "Solicitud invalida." }, 400);
    }

    const payload = body as Record<string, unknown>;
    const honeypot = safeName(payload.company);

    if (honeypot) {
      return respond({ ok: true });
    }

    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";

    if (!EMAIL_PATTERN.test(email) || email.length>254) {
      return respond({ ok: false, error: "Introduce un correo valido." }, 400);
    }

    const firstName = safeName(payload.firstName);
    const lastName = safeName(payload.lastName);
    const anonymousId = safeName(payload.anonymousId);
    const requestId = safeName(payload.requestId) || anonymousId;
    const privacyAcknowledged = payload.privacyAcknowledged === true;
    const marketingConsent = payload.marketingConsent === true;
    const resource = payload.resource ?? "manifesto";
    if(resource!=="manifesto" && resource!=="seven_stories")return respond({ok:false,error:"Recurso no valido."},400);
    const newsletter = resource==="seven_stories";
    if(newsletter && (!marketingConsent || payload.consentAction!=="newsletter_pdf"))return respond({ok:false,error:"Confirma la suscripcion a la newsletter."},400);
    const name = `${firstName} ${lastName}`.trim();
    const kind = newsletter ? "newsletter" : "manifesto";

    if (
      (!newsletter && !firstName) ||
      !UUID_PATTERN.test(anonymousId) ||
      !UUID_PATTERN.test(requestId) ||
      !privacyAcknowledged
    ) {
      return respond(
        { ok: false, error: "Completa los datos y revisa la informacion de privacidad." },
        400
      );
    }

    if(optionalEnv("COMMERCE_EMAIL_MODE")==="disabled")return respond({ok:false,error:"Envio desactivado en este entorno de pruebas."},503);
    const db=await database();
    const saved=await db.from("manifesto_requests").upsert({id:requestId,email,name,resource,source:safeSource(payload.source),marketing_consent:marketingConsent},{onConflict:"id",ignoreDuplicates:true});
    if(saved.error)throw Error("DATABASE_UNAVAILABLE");
    const existing=await db.from("manifesto_requests").select("email,name,resource,marketing_consent,status").eq("id",requestId).single();
    if(existing.error)throw Error("DATABASE_UNAVAILABLE");
    if(existing.data.email!==email || existing.data.name!==name || existing.data.resource!==resource || existing.data.marketing_consent!==marketingConsent)return respond({ok:false,error:"La solicitud ha cambiado. Recarga el formulario."},409);
    if(existing.data.status==="accepted"){
      await notifyLead({kind,reference:requestId,email,name});
      return respond({ok:true,message:"El PDF ya ha sido enviado por correo."});
    }
    await recordLegalConsents([
      {
        anonymousId,
        consentType: "privacy_acknowledgement",
        documentVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
        accepted: true,
        source: newsletter ? "newsletter_pdf" : "manifesto",
        contextType: "resource_request",
        contextId: requestId,
        metadata: { resource },
      },
      ...(marketingConsent?[{anonymousId,consentType:"marketing_email" as const,documentVersion:LEGAL_DOCUMENT_VERSIONS.privacy,accepted:true,source:newsletter?"newsletter_pdf":"manifesto",contextType:"resource_request",contextId:requestId,metadata:{resource,copy_version:EMAIL_MARKETING_COPY_VERSION,consent_text:EMAIL_MARKETING_CONSENT,action:newsletter?"Suscribirme y recibir el PDF":"optional_checkbox"}}]:[]),
    ]);

    const greeting = name ? `Hola ${name},` : "Hola,";
    const source = safeSource(payload.source);
    const from = `Imperio Espanol <${SITE.contactEmail}>`;
    const attachmentPath = newsletter ? NEWSLETTER_PDF_PATH :
      import.meta.env.MANIFESTO_ATTACHMENT_URL?.trim() ||
      import.meta.env.MANIFESTO_PDF_URL?.trim() ||
      import.meta.env.MANIFESTO_ATTACHMENT_PATH?.trim() ||
      import.meta.env.MANIFESTO_PDF_PATH?.trim() ||
      "/manifesto-email.pdf";
    const attachmentUrl = attachmentPath.startsWith("http")
      ? attachmentPath
      : `${publicSiteUrl}/${attachmentPath.replace(/^\/+/, "")}`;
    const subject = newsletter ? "Tus 7 historias del Siglo de Oro" : "Tu manifiesto de Imperio Espanol";
    const message = newsletter ? "Gracias por acercarte a Imperio Español. Aquí tienes tus 7 historias del Siglo de Oro, adjuntas en PDF. Ojalá disfrutes leyéndolas tanto como nosotros al prepararlas."
      : "Gracias por pedir el manifiesto. Te lo dejamos adjunto a este correo.";
    const unsubscribe = marketingConsent ? `${publicSiteUrl}/comunicaciones/baja?token=${unsubscribeToken(email)}` : "";
    const marketingNote = marketingConsent ? "También has pedido recibir historias, novedades, lanzamientos y ofertas por email. Puedes darte de baja cuando quieras." : "";
    const text = [greeting,message,marketingNote,unsubscribe?`Darme de baja: ${unsubscribe}`:"","Un abrazo,\nEquipo de Imperio Español"].filter(Boolean).join("\n\n");
    const { resend } = await import("../../lib/resend");
    const result = await resend.emails.send({
      from,
      replyTo: SITE.contactEmail,
      to: optionalEnv("COMMERCE_EMAIL_MODE")==="test"?getRequiredEnv("COMMERCE_TEST_EMAIL"):email,
      subject,
      html: `
        <div style="font-family: Georgia, serif; line-height: 1.6; color: #111;">
          <p>${escapeHtml(greeting)}</p>
          <p>${escapeHtml(message)}</p>
          ${marketingConsent?`<p>${marketingNote} <a href="${escapeHtml(unsubscribe)}">Darme de baja</a></p>`:""}
          <p>Un abrazo,<br><strong>Equipo de Imperio Español</strong></p>
        </div>
      `,
      text,
      attachments: [
        {
          filename: newsletter ? "7 historias del Siglo de Oro.pdf" : "Manifiesto Imperio Espanol.pdf",
          path: attachmentUrl,
        },
      ],
      tags: [
        {
          name: "source",
          value: source,
        },
      ],
    }, { idempotencyKey: `manifesto-${requestId}` });

    if (result.error) {
      await db.from("manifesto_requests").update({status:"failed"}).eq("id",requestId);
      console.error("Resend manifesto email failed:", result.error);
      return respond(
        { ok: false, error: "No se pudo enviar el correo. Intentalo de nuevo." },
        502
      );
    }

    if(!result.data)throw Error("EMAIL_PROVIDER_UNAVAILABLE");
    const accepted=await db.from("manifesto_requests").update({status:"accepted",provider_id:result.data.id,accepted_at:new Date().toISOString()}).eq("id",requestId);
    if(accepted.error)throw Error("DATABASE_UNAVAILABLE");
    await notifyLead({ kind, reference: requestId, email, name });

    return respond({
      ok: true,
      message: "Te hemos enviado el PDF por correo.",
    });
  } catch (error) {
    console.error("manifesto endpoint error:", error);
    return respond(
      { ok: false, error: "No se pudo enviar el correo. Intentalo de nuevo." },
      500
    );
  }
};
