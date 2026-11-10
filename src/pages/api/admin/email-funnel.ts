import { randomUUID } from "node:crypto";
import type { APIRoute } from "astro";
import { auditAdmin } from "../../../lib/admin-data";
import { readEmailFunnel, readEmailFunnelContact } from "../../../lib/email-funnel";
import { failure, limited, privateJson, requireAdmin } from "../../../lib/reservations";

export const prerender = false;

export const GET: APIRoute = async context => {
  try {
    const actor = await requireAdmin(context);
    await limited(context.request, "admin_email_funnel", 60);
    const detail = context.url.searchParams.get("detail");
    if (detail) {
      await auditAdmin(actor.id, "email_funnel", randomUUID(), "ADMIN_PRIVATE_READ");
      return privateJson(await readEmailFunnelContact(detail));
    }
    await auditAdmin(actor.id, "email_funnel", randomUUID(), "ADMIN_PRIVATE_READ");
    return privateJson(await readEmailFunnel(context.url.searchParams));
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_FUNNEL_MIGRATION_REQUIRED") {
      return privateJson({
        code: "EMAIL_FUNNEL_MIGRATION_REQUIRED",
        error: "Las vistas privadas del embudo de email aún no están disponibles. Aplicar la migración 054 en el entorno revisado. No se han cargado datos ficticios.",
      }, 503);
    }
    return failure(error);
  }
};
