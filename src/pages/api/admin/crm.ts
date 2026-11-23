import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requestBody, requireAdmin } from "../../../lib/reservations";
import { automationRuntimeActive } from "../../../lib/automation-worker";
import { automationRevenue, ga4Summary } from "../../../lib/ga4-reports";
import { crmAlerts, validateCommercialPause, type CrmReport } from "../../../lib/crm-performance";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context); await limited(context.request, "admin_crm_read", 30);
    const result = await (await database()).rpc("crm_performance_stats");
    if (result.error && ["PGRST202", "42883"].includes(result.error.code))
      return privateJson({ error: "El informe de CRM requiere las migraciones 060 y 061 en este entorno.", code: "CRM_MIGRATION_REQUIRED" }, 503);
    if (result.error || !result.data?.health_24h || !result.data?.policy) throw Error("DATABASE_UNAVAILABLE");
    const report = result.data as CrmReport;
    return privateJson({ report, alerts: crmAlerts(report.health_24h), sendsEnabled: await automationRuntimeActive(),
      ga4: automationRevenue(await ga4Summary(30)) });
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async context => {
  try {
    const actor = await requireAdmin(context); await limited(context.request, "admin_crm_pause", 15);
    const body = validateCommercialPause(await requestBody(context.request));
    const result = await (await database()).rpc("set_crm_commercial_pause", {
      p_actor: actor.id, p_expected: body.expected, p_paused: body.paused, p_kinds: body.kinds,
    });
    if (result.error?.message === "REQUEST_CONFLICT") return privateJson({ error: "La política ha cambiado. Actualiza el panel antes de continuar." }, 409);
    if (result.error) throw Error("DATABASE_UNAVAILABLE");
    return privateJson({ policy: result.data });
  } catch (error) { return failure(error); }
};
