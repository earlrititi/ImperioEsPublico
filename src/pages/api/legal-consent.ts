import type { APIRoute } from "astro";
import { LEGAL_DOCUMENT_VERSIONS } from "../../config/legal";
import { recordLegalConsents } from "../../lib/legal-consents";
import { consumeRateLimit } from "../../lib/rate-limit";
import { isAllowedRequestOrigin } from "../../lib/request-security";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { clearAuthAnalytics } from "../../lib/auth-analytics";
import { consentExperimentEnabled } from "../../lib/consent-experiment-env";
import { isExperimentDecision } from "../../lib/cookie-consent";

export const prerender = false;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = new Set(["cookie_banner", "cookie_settings"]);
const EXPERIMENT_COOKIE = "imperio_consent_experiment_v1";
const experimentHeaders = { "Cache-Control": "private, no-store" };

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const GET: APIRoute = ({ cookies, url }) => {
  if (url.searchParams.get("experiment") !== "1" || !consentExperimentEnabled(url.hostname)) {
    return new Response(null, { status: 404, headers: experimentHeaders });
  }
  const decision = cookies.get(EXPERIMENT_COOKIE)?.value;
  return Response.json({ decision: isExperimentDecision(decision) ? decision : null }, { headers: experimentHeaders });
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  const experiment = consentExperimentEnabled(url.hostname);
  if (url.searchParams.has("experiment") || experiment) {
    if (url.searchParams.get("experiment") !== "1" || !experiment) {
      return new Response(null, { status: 404, headers: experimentHeaders });
    }
    if (request.headers.get("origin") !== url.origin) {
      return new Response(null, { status: 403, headers: experimentHeaders });
    }
    const raw = Number(request.headers.get("content-length")) > 128 ? "" : await request.text();
    let payload: unknown;
    try { payload = raw.length <= 128 ? JSON.parse(raw) : null; } catch { payload = null; }
    const decision = payload && typeof payload === "object" && Object.keys(payload).length === 1 && "decision" in payload
      ? payload.decision : null;
    if (!isExperimentDecision(decision)) {
      return new Response(null, { status: 400, headers: experimentHeaders });
    }
    cookies.set(EXPERIMENT_COOKIE, decision, {
      path: "/api/legal-consent",
      httpOnly: true,
      sameSite: "strict",
      secure: url.protocol === "https:",
      maxAge: 7 * 24 * 60 * 60,
    });
    return Response.json({ decision }, { headers: experimentHeaders });
  }

  if (!isAllowedRequestOrigin(request, import.meta.env.PUBLIC_SITE_URL)) {
    return json({ error: "Origen no permitido" }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > 4096) {
    return json({ error: "Solicitud demasiado grande" }, 413);
  }

  try {
    const allowed = await consumeRateLimit({
      request,
      endpoint: "legal_consent",
      limit: 30,
      windowSeconds: 15 * 60,
    });

    if (!allowed) {
      return json({ error: "Demasiadas solicitudes" }, 429);
    }
  } catch (error) {
    console.error(
      "legal-consent rate limit failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return json({ error: "No se pudo registrar la preferencia" }, 503);
  }

  const body = await request.json().catch(() => null);
  const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId : "";
  const source = typeof body?.source === "string" ? body.source : "";
  const version = typeof body?.version === "string" ? body.version : "";
  const choices = body?.choices;

  if (
    !UUID_PATTERN.test(anonymousId) ||
    !SOURCES.has(source) ||
    version !== LEGAL_DOCUMENT_VERSIONS.cookies ||
    !choices ||
    typeof choices.preferences !== "boolean" ||
    typeof choices.analytics !== "boolean" ||
    typeof choices.marketing !== "boolean"
  ) {
    return json({ error: "Preferencias no validas" }, 400);
  }

  if (!choices.analytics) clearAuthAnalytics({ cookies, request });
  const supabase = createSupabaseServerClient({ cookies, request });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const cookieChoices = [
      { consentType: "cookies_preferences", accepted: choices.preferences },
      { consentType: "cookies_analytics", accepted: choices.analytics },
      { consentType: "cookies_marketing", accepted: choices.marketing },
    ] as const;

    await recordLegalConsents(
      cookieChoices.map(({ consentType, accepted }) => ({
        userId: user?.id ?? null,
        anonymousId,
        consentType,
        documentVersion: version,
        accepted,
        source,
      }))
    );
  } catch (error) {
    console.error(
      "legal-consent persistence failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return json({ error: "No se pudo registrar la preferencia" }, 503);
  }

  return new Response(null, { status: 204 });
};
