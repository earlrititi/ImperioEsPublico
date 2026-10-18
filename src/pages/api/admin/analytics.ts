import type { APIRoute } from "astro";
import { failure, privateJson, requireAdmin, rpc, limited } from "../../../lib/reservations";
import { ga4Summary } from "../../../lib/ga4-reports";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context);
    await limited(context.request, "admin_analytics", 20);
    const days = Number(context.url.searchParams.get("days") ?? 30);
    if (![7, 30, 90, 365].includes(days)) return privateJson({ error: "Periodo no valido." }, 400);
    const [local, ga4] = await Promise.all([rpc("admin_analytics_summary", { p_days: days }), ga4Summary(days)]);
    return privateJson({ ...local, ga4 });
  } catch (error) { return failure(error); }
};
