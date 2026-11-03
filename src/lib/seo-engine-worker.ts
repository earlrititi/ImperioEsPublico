import { Resend } from "resend";
import { database, rpc } from "./reservations";
import { SITE } from "../config/site";
import { REVIEW_EMAIL } from "./seo-engine-model";
import { editorialInventory } from "./seo-engine-inventory";
import { generateEditorial, generatedArticle, verifyEditorial, editorialProviderConfig } from "./seo-engine-generation";
import { engineConfiguration, sourceRecords, proposeEditorial, runAudit, searchConsoleReport, scheduleEngine, seoFingerprint, queueGeneration } from "./seo-engine";
import { renderAdminMail } from "./admin-mail-template";
import { randomUUID } from "node:crypto";

async function finishJob(job: any, patch: Record<string, unknown>) {
  const r = await (await database()).from("seo_jobs").update(patch).eq("id", job.id).eq("claim_id", job.claim_id).eq("status", "processing").select("id");
  if (r.error || r.data?.length !== 1) throw Error("SEO_JOB_CONFLICT");
}
export function reviewMail(review: any, opportunity: any, published = false) {
  const link = `${SITE.url}/admin/seo?review=${review.id}`, v = review.verification;
  const content = [published ? "Articulo publicado despues de aprobacion administrativa." : "Nuevo articulo preparado para revision", `Titulo: ${review.snapshot.title}`, `Categoria: ${review.snapshot.category}`, `Keyword principal: ${opportunity.keyword}`, `Articulos relacionados: ${opportunity.relatedSlugs.length}`, `Fuentes con extracto comprobado: ${review.source_snapshot.length}`, `Advertencias: ${v.warnings.length}`, `Bloqueos: ${v.blockers.length}`, `Estado: ${published ? "Publicado" : "Pendiente de revision"}`, review.snapshot.lead,
    "Fuentes:", ...review.source_snapshot.map((s: any) => `${s.title}: ${s.url}`), "Control automatico orientativo, no validacion academica.", ...v.blockers, ...v.warnings, `Vista previa privada y revision: ${link}`, `Panel editorial: ${SITE.url}/admin/seo`].join("\n\n");
  return { from: `Imperio E <${SITE.contactEmail}>`, replyTo: SITE.contactEmail, to: REVIEW_EMAIL,
    subject: `[IMPERIO E] ${published ? "Articulo publicado" : "Nuevo articulo pendiente de aprobacion"} - ${review.snapshot.title}`.slice(0, 250),
    ...renderAdminMail({ subject: "Revision editorial", preheader: "Revision humana obligatoria", content, cta_label: published ? "Ver revision" : "Abrir revision privada", cta_url: link }) };
}
async function notify(job: any) {
  if (!process.env.RESEND_API_KEY) throw Error("SEO_MAIL_NOT_CONFIGURED");
  const db = await database();
  let payload = job.payload.message;
  if (!payload) {
    const r = await db.from("seo_reviews").select("*").eq("id", job.review_id).single();
    if (r.error) throw Error("DATABASE_UNAVAILABLE");
    const o = await db.from("seo_opportunities").select("data").eq("id", r.data.opportunity_id).single(); if (o.error) throw Error("DATABASE_UNAVAILABLE");
    payload = reviewMail(r.data, o.data.data, job.payload.event === "published");
    const snapshot = await db.from("seo_jobs").update({ payload: { ...job.payload, message: payload } }).eq("id", job.id).eq("claim_id", job.claim_id).select("id");
    if (snapshot.error || snapshot.data?.length !== 1) throw Error("SEO_JOB_CONFLICT");
  }
  if (payload.to !== REVIEW_EMAIL || payload.cc || payload.bcc) throw Error("SEO_MAIL_RECIPIENT_MISMATCH");
  const sent = await new Resend(process.env.RESEND_API_KEY).emails.send(payload, { idempotencyKey: `seo-${job.id}` });
  if (sent.error || !sent.data) throw Error("SEO_MAIL_PROVIDER_UNAVAILABLE");
  await finishJob(job, { status: "succeeded", provider_id: sent.data.id, delivery_status: "accepted_by_provider", finished_at: new Date().toISOString() });
}
async function generate(job: any) {
  const p = job.payload, sources = await sourceRecords(p.opportunity.sourceIds, true);
  if (seoFingerprint(JSON.stringify(sources.map(s => s.digest))) !== seoFingerprint(JSON.stringify(p.sources.map((s: any) => s.digest)))) throw Error("SEO_SOURCE_CHANGED");
  await rpc("seo_generation_stage", { p_job: job.id, p_claim: job.claim_id, p_stage: "generating" });
  const result = await generateEditorial(p.context, p), inventory = await editorialInventory();
  await rpc("seo_generation_stage", { p_job: job.id, p_claim: job.claim_id, p_stage: "validating" });
  const draft = generatedArticle(result.generated, sources, inventory.filter(a => p.opportunity.relatedSlugs.includes(a.slug)));
  const verification = verifyEditorial(draft, result.generated.claims, sources, result.generated.contribution, inventory);
  await rpc("seo_complete_generation", { p_job: job.id, p_claim: job.claim_id, p_draft: draft, p_verification: verification, p_sources: sources, p_usage: result.usage });
}
export async function queueSeoNotice(actor: string, key: string, subject: string, content: string) {
  const message = { from: `Imperio E <${SITE.contactEmail}>`, replyTo: SITE.contactEmail, to: REVIEW_EMAIL, subject,
    ...renderAdminMail({ subject, preheader: "Aviso administrativo SEO", content, cta_label: "Abrir panel", cta_url: `${SITE.url}/admin/seo` }) };
  const r = await (await database()).from("seo_jobs").upsert({ kind: "notify", job_key: `notice:${key}`, actor_id: actor, payload: { event: "notice", message } }, { onConflict: "job_key", ignoreDuplicates: true });
  if (r.error) throw Error("DATABASE_UNAVAILABLE");
}
export async function reconcileSeoMail() {
  const cfg = await engineConfiguration(); if (cfg.settings.mailPaused || !process.env.RESEND_API_KEY) return { checked: 0 };
  const db = await database(), r = await db.from("seo_jobs").select("id,provider_id").eq("kind", "notify").eq("status", "succeeded").not("provider_id", "is", null)
    .gte("finished_at", new Date(Date.now() - 7 * 86400000).toISOString()).or(`provider_checked_at.is.null,provider_checked_at.lt.${new Date(Date.now() - 6 * 3600000).toISOString()},delivery_status.in.(queued,sent,accepted_by_provider,delivery_delayed)`).limit(3);
  if (r.error) throw Error("DATABASE_UNAVAILABLE");
  const client = new Resend(process.env.RESEND_API_KEY); let checked = 0;
  for (const row of r.data) { const result = await client.emails.get(row.provider_id); if (result.error || !result.data) continue;
    const state = ["opened", "clicked"].includes(result.data.last_event) ? "delivered" : result.data.last_event;
    const u = await db.from("seo_jobs").update({ delivery_status: state, provider_checked_at: new Date().toISOString() }).eq("id", row.id); if (u.error) throw Error("DATABASE_UNAVAILABLE"); checked++;
  }
  return { checked };
}
export async function runSeoWorker(kinds = ["notify", "daily", "weekly", "monthly", "generate"]) {
  const result: { kind: string; status: string; id: string }[] = [];
  const started = Date.now();
  await scheduleEngine();
  for (const kind of kinds) {
    if (Date.now() - started > 45000) break;
    const job = (await rpc("seo_claim_job", { p_kind: kind }))?.[0]; if (!job) continue;
    try {
      let output: unknown = {};
      if (kind === "generate") { await generate(job); result.push({ id: job.id, kind, status: "succeeded" }); continue; }
      if (kind === "notify") { await notify(job); result.push({ id: job.id, kind, status: "accepted_by_provider" }); continue; }
      if (kind === "daily") {
        output = await runAudit(job.actor_id, job.job_key);
        if ((output as any)?.data?.critical > 0) await queueSeoNotice(job.actor_id, job.job_key, "[IMPERIO E] Incidencias en auditoria SEO", JSON.stringify((output as any).data.results));
      }
      if (kind === "weekly") {
        output = await proposeEditorial(job.actor_id, job.job_key);
        if (editorialProviderConfig().available) {
          const approved = await (await database()).from("seo_opportunities").select("id,revision").eq("status", "approved").order("updated_at").limit(2);
          if (approved.error) throw Error("DATABASE_UNAVAILABLE");
          for (const row of approved.data) try { await queueGeneration(job.actor_id, row.id, row.revision); } catch { /* Budget, pause and source gates remain authoritative. */ }
        }
      }
      if (kind === "monthly") {
        await rpc("seo_retention");
        const metrics = await searchConsoleReport(), inventory = await editorialInventory();
        const data = { period: job.job_key, createdAt: new Date().toISOString(), searchConsole: metrics, articles: inventory.length, pendingSourceReviews: inventory.filter(a => a.issues.some(i => i.includes("bibliografia"))).length, note: "Inventario cualitativo y datos autorizados. Sin estimaciones de trafico o citas." };
        await rpc("seo_save", { p_actor: job.actor_id, p_kind: "report", p_id: randomUUID(), p_revision: 0, p_data: data, p_fingerprint: seoFingerprint(job.job_key) }); output = { saved: true };
      }
      await finishJob(job, { status: "succeeded", result: output, finished_at: new Date().toISOString() }); result.push({ id: job.id, kind, status: "succeeded" });
    } catch (error) {
      const code = error instanceof Error && /^SEO_[A-Z_]+$/.test(error.message) ? error.message : "SEO_JOB_FAILED";
      const notifyRetry = kind === "notify" && job.attempts < 5;
      await finishJob(job, { status: kind === "generate" ? "needs_review" : notifyRetry ? "failed" : "needs_review", error: code, due_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)).toISOString() });
      if (kind === "generate") {
        await (await database()).from("seo_opportunities").update({ status: code.includes("SOURCE") ? "needs_sources" : "generation_failed", updated_at: new Date().toISOString() }).eq("id", job.opportunity_id).in("status", ["researching", "generating", "validating"]);
      }
      result.push({ id: job.id, kind, status: code });
      if (kind !== "notify") await queueSeoNotice(job.actor_id, `failure:${job.id}`, "[IMPERIO E] Trabajo SEO pendiente de revision", `Trabajo: ${job.kind}\nEstado: ${code}\nNo se ha publicado contenido. Revisa el panel administrativo.`);
    }
  }
  return { jobs: result, delivery: await reconcileSeoMail() };
}
