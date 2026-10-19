import type { APIRoute } from "astro";
import { failure, optionalEnv, privateJson, safeEqual } from "../../lib/reservations";
import { automationDeliveryReceipts, runMarketingAutomations } from "../../lib/automation-worker";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const secret = optionalEnv("COMMERCE_JOB_SECRET");
    if (secret.length < 32 || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) throw Error("FORBIDDEN");
    return privateJson({ ...(await runMarketingAutomations(10)), delivery: await automationDeliveryReceipts(10) });
  } catch (error) { return failure(error); }
};
