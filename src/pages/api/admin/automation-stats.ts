import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requireAdmin } from "../../../lib/reservations";
import { automationRuntimeActive } from "../../../lib/automation-worker";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context); await limited(context.request, "admin_automation_stats", 30);
    const result = await (await database()).rpc("marketing_automation_stats");
    if (result.error && ["PGRST202", "42883"].includes(result.error.code)) return privateJson({ runtimeReady: false, sendsEnabled: false, items: null, attributedRevenue: null });
    if (result.error) throw Error("DATABASE_UNAVAILABLE");
    const runtime=await (await database()).from("marketing_automation_runtime").select("enrollment_starts_at").eq("id",true).single();
    return privateJson({ runtimeReady: true, sendsEnabled: await automationRuntimeActive(), items: result.data,
      enrollmentStartsAt:runtime.error?null:runtime.data.enrollment_starts_at,attributedRevenue: null });
  } catch (error) { return failure(error); }
};
