import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { database, failure, limited, privateJson, requestBody, requireAdmin, rpc } from "../../../lib/reservations";
import { UUID } from "../../../lib/reservation-validation";
import { engineSettingsSchema } from "../../../lib/seo-engine-model";
import { seoDashboard, saveOpportunity, saveSource, queueGeneration, reviewDetail, resubmitReview, decideReview, saveCollaboration, checkCollaboration, saveObservation, searchConsoleReport, runAudit, proposeEditorial, seoFingerprint } from "../../../lib/seo-engine";
import { runSeoWorker, queueSeoNotice } from "../../../lib/seo-engine-worker";
export const prerender = false;
function seoFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code.startsWith("SEO_") || code === "REQUEST_CONFLICT") return privateJson({ code, error: code }, code === "SEO_MIGRATION_REQUIRED" ? 503 : 409);
  if (error instanceof Error && error.name === "ZodError") return privateJson({ error: "Revisa los campos del formulario.", code: "INVALID_INPUT" }, 400);
  return failure(error);
}
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context); await limited(context.request, "admin_seo_read", 60);
    const review = context.url.searchParams.get("review");
    if (review) { if (!UUID.test(review)) throw Error("INVALID_INPUT"); return privateJson(await reviewDetail(review)); }
    return privateJson(await seoDashboard());
  } catch (error) { return seoFailure(error); }
};
export const POST: APIRoute = async context => {
  try {
    const actor = await requireAdmin(context); await limited(context.request, "admin_seo_write", 40);
    const b = await requestBody(context.request, 240000);
    const id = b.id ?? randomUUID(), revision = b.revision ?? 0;
    if (!UUID.test(id) || !Number.isInteger(revision) || revision < 0) throw Error("INVALID_INPUT");
    switch (b.action) {
      case "settings": {
        const settings = engineSettingsSchema.parse(b.data);
        return privateJson(await rpc("seo_save", { p_actor: actor.id, p_kind: "settings", p_id: id, p_revision: revision, p_data: settings, p_fingerprint: "settings" }));
      }
      case "opportunity": return privateJson(await saveOpportunity(actor.id, id, revision, b.data));
      case "reopen_opportunity": return privateJson(await rpc("seo_reopen_opportunity", { p_actor: actor.id, p_id: id, p_revision: revision }));
      case "opportunity_state":
        if (!["approved", "rejected", "archived"].includes(b.state)) throw Error("INVALID_INPUT");
        return privateJson(await rpc("seo_opportunity_action", { p_actor: actor.id, p_id: id, p_revision: revision, p_action: b.state }));
      case "source": return privateJson(await saveSource(actor.id, id, revision, b.data));
      case "generate": return privateJson(await queueGeneration(actor.id, id, revision));
      case "review": return privateJson(await decideReview(actor.id, id, revision, b.decision, b.reviewer ?? "", b.note ?? "", b.confirmed === true));
      case "resubmit": return privateJson(await resubmitReview(actor.id, id, revision, b.claims, String(b.contribution ?? "").slice(0, 2000)));
      case "collaboration": return privateJson(await saveCollaboration(actor.id, id, revision, b.data));
      case "check_collaboration": return privateJson(await checkCollaboration(actor.id, id));
      case "observation": return privateJson(await saveObservation(actor.id, id, b.data));
      case "opportunities": return privateJson(await proposeEditorial(actor.id));
      case "audit": return privateJson(await runAudit(actor.id, randomUUID()));
      case "metrics": {
        const data = await searchConsoleReport();
        await rpc("seo_save", { p_actor: actor.id, p_kind: "metrics", p_id: id, p_revision: 0, p_data: data, p_fingerprint: seoFingerprint(`gsc:${new Date().toISOString().slice(0, 10)}`) });
        return privateJson(data);
      }
      case "run": return privateJson(await runSeoWorker());
      case "test_notice":
        if (b.confirmed !== true) throw Error("INVALID_INPUT");
        await queueSeoNotice(actor.id, `controlled-test:${id}`, "[IMPERIO E] Prueba controlada del aviso editorial", "Prueba administrativa del motor SEO. Esta prueba no crea ni publica un articulo historico. Las revisiones de articulos se notificaran a este mismo buzon y exigiran aprobacion administrativa.");
        return privateJson({ queued: true, ...(await runSeoWorker(["notify"])) });
      case "retry_notice": {
        if (b.confirmed !== true) throw Error("INVALID_INPUT");
        const result = await (await database()).from("seo_jobs").update({ status: "pending", due_at: new Date().toISOString() }).eq("id", id).eq("kind", "notify").eq("status", "failed").lt("attempts", 5).select("id");
        if (result.error || !result.data?.length) throw Error("SEO_RETRY_REQUIRES_REVIEW");
        return privateJson({ queued: true });
      }
      default: throw Error("INVALID_INPUT");
    }
  } catch (error) { return seoFailure(error); }
};
