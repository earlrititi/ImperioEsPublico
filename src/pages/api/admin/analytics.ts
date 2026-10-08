import type { APIRoute } from "astro";
import { failure, privateJson, requireAdmin, rpc } from "../../../lib/reservations";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context);
    const days = Number(context.url.searchParams.get("days") ?? 30);
    if (![7, 30, 90, 365].includes(days)) return privateJson({ error: "Periodo no valido." }, 400);
    return privateJson(await rpc("admin_analytics_summary", { p_days: days }));
  } catch (error) { return failure(error); }
};
