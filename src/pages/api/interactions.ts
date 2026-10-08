import type { APIRoute } from "astro";
import { CONSENT_KEY, parseConsent } from "../../lib/cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../../config/legal";
import { limited, requestBody, rpc } from "../../lib/reservations";
import { validInteraction } from "../../lib/interaction-validation";
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const raw = cookies.get(CONSENT_KEY)?.value;
    const consent = parseConsent(raw ?? null, LEGAL_DOCUMENT_VERSIONS.cookies);
    if (!consent?.analytics) return new Response(null, { status: 204 });
    await limited(request, "interaction", 180);
    const body = await requestBody(request);
    if (!validInteraction(body)) return new Response(null, { status: 400 });
    await rpc("record_site_interaction", { p_page: body.page, p_target: body.target, p_event: body.event });
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch { return new Response(null, { status: 503 }); }
};
