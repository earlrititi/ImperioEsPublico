import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requestBody, requireAdmin, rpc } from "../../../lib/reservations";
import { AUTOMATION_DEFAULTS, personalizeAutomation, validateAutomationDraft } from "../../../lib/email-automations";
import { renderAdminMail } from "../../../lib/admin-mail-template";
import { automationRuntimeActive } from "../../../lib/automation-worker";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context);
    await limited(context.request, "admin_automations_read", 60);
    const result = await (await database()).from("marketing_automation_drafts").select("key,steps,revision").limit(6);
    if (result.error && result.error.code !== "PGRST205" && result.error.code !== "42P01") throw Error("DATABASE_UNAVAILABLE");
    return privateJson({ storageReady: !result.error, sendsEnabled: await automationRuntimeActive(), items: AUTOMATION_DEFAULTS.map(definition => {
      const stored = result.data?.find(row => row.key === definition.key);
      return stored ? { ...definition, steps: validateAutomationDraft(definition.key, stored.steps), revision: stored.revision } : definition;
    }) });
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async context => {
  try {
    const user = await requireAdmin(context);
    await limited(context.request, "admin_automations", 20);
    const body = await requestBody(context.request, 65536);
    const steps = validateAutomationDraft(body.key, body.steps);
    if (body.action === "preview") {
      if (!Number.isInteger(body.step) || !steps[body.step]) throw Error("INVALID_INPUT");
      return privateJson(renderAdminMail(personalizeAutomation(steps[body.step].mail, "Lector"), "https://imperioes.com/comunicaciones/baja", true));
    }
    if (body.action !== "save" || !Number.isInteger(body.revision) || body.revision < 0) throw Error("INVALID_INPUT");
    const revision = await rpc("save_marketing_automation_draft", { p_key: body.key, p_actor: user.id, p_revision: body.revision, p_steps: steps });
    return privateJson({ revision, sendsEnabled: false });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_CONFLICT") return privateJson({ error: "El borrador ha cambiado. Recarga antes de guardar.", code: "REQUEST_CONFLICT" }, 409);
    return failure(error);
  }
};
