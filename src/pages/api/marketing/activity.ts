import type { APIRoute } from "astro";
import { CONSENT_KEY, parseConsent } from "../../../lib/cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../../../config/legal";
import { captureAutomationActivity } from "../../../lib/automation-worker";
import { failure, getUser, limited, optionalEnv, privateJson, requestBody } from "../../../lib/reservations";
export const prerender = false;
export const POST: APIRoute = async context => {
  try {
    if (optionalEnv("MARKETING_AUTOMATION_CAPTURE_ENABLED") !== "true" ||
      !parseConsent(context.cookies.get(CONSENT_KEY)?.value ?? null, LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) return new Response(null, { status: 204 });
    await limited(context.request, "automation_activity", 30);
    const body = await requestBody(context.request, 1024);
    if (!body || !["site", "viewed_product", "cart", "cart_cleared"].includes(body.kind) || Object.keys(body).length !== 1) throw Error("INVALID_INPUT");
    const user = await getUser(context);
    if (!user?.email_confirmed_at) return new Response(null, { status: 204 });
    return privateJson({ recorded: Boolean(await captureAutomationActivity(user.id, body.kind)) });
  } catch (error) { return failure(error); }
};
