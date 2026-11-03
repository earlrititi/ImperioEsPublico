import type { APIRoute } from "astro";
import { failure, privateJson, safeEqual } from "../../lib/reservations";
import { runSeoWorker } from "../../lib/seo-engine-worker";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const secret = process.env.COMMERCE_JOB_SECRET ?? "";
    if (secret.length < 32 || !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) throw Error("FORBIDDEN");
    if (process.env.SEO_ENGINE_ENABLED !== "true") return privateJson({ enabled: false });
    return privateJson(await runSeoWorker());
  } catch (error) { return failure(error); }
};
