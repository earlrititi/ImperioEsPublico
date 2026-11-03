import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

for (const file of [".env.local", ".env.admin-production.local", ".vercel/.env.production.local"]) {
  if (existsSync(file)) Object.assign(process.env, Object.fromEntries(Object.entries(parseEnv(readFileSync(file, "utf8"))).filter(([, value]) => value && value !== "[SENSITIVE]")));
}
const env = process.env;
assert.equal(new URL(env.PUBLIC_SUPABASE_URL).hostname, "pjrqozlyrjgugdraoght.supabase.co");
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const actor = "24f42701-98e0-4716-810c-363ae1cc8fa2", chunks = resolve(".vercel/output/functions/_render.func/dist/server/chunks");
const bundle = readdirSync(chunks).find(n => /^seo-engine-worker_.+\.mjs$/.test(n)); assert.ok(bundle, "Build first");
const module = await import(pathToFileURL(join(chunks, bundle)).href);
const ops = Object.values(module).find(v => v && typeof v === "object" && typeof v.runSeoWorker === "function");
assert.ok(ops, "SEO worker exports unavailable");
function check(r) { if (r.error) throw Error(r.error.message.match(/^[A-Z_]+$/)?.[0] || "SEO_DATABASE_OPERATION_FAILED"); return r.data; }
async function configure(settings, revision) { return check(await db.rpc("seo_save", { p_actor: actor, p_kind: "settings", p_id: randomUUID(), p_revision: revision, p_data: settings, p_fingerprint: "settings" })); }
if (process.argv.includes("--inventory")) {
  const summaryFn = Object.values(module).find(v => typeof v === "function" && v.name === "seoDashboard"); assert.ok(summaryFn);
  const d = await summaryFn(); console.log(JSON.stringify({ articles: d.inventory.length, graphEdges: d.graph.length, queries: d.queries.length, sources: d.records.filter(r => r.kind === "source").length, opportunities: d.opportunities.length, pendingReviews: d.reviews.filter(r => r.status === "pending_review").length, connections: d.connections }));
}
if (process.argv.includes("--propose")) {
  const fn = Object.values(module).find(v => typeof v === "function" && v.name === "proposeEditorial"); assert.ok(fn); console.log(JSON.stringify(await fn(actor)));
}
if (process.argv.includes("--seed-sources")) {
  const saveSource = Object.values(module).find(v => typeof v === "function" && v.name === "saveSource");
  const saveCollaboration = Object.values(module).find(v => typeof v === "function" && v.name === "saveCollaboration");
  assert.ok(saveSource && saveCollaboration);
  const sources = [
    { title: "Catalogo guiado de las obras de Miguel de Cervantes", url: "https://www.cervantesvirtual.com/portales/miguel_de_cervantes/obras_catalogo_guiado/", institution: "Biblioteca Virtual Miguel de Cervantes", excerpt: "Las obras se ofrecen en formato digital, en ediciones de diferentes especialistas" },
    { title: "Cervantes en la BNE: su biblioteca", url: "https://cervantes.bne.es/es/su-biblioteca", institution: "Biblioteca Nacional de Espana", excerpt: "Si bien existe tambien la posibilidad de que poseyera manuscritos" },
  ];
  for (const source of sources) {
    try { await saveSource(actor, randomUUID(), 0, { ...source, author: "", year: "", shelfmark: "" }); console.log(JSON.stringify({ source: source.title, verification: "excerpt_matched" })); }
    catch (e) { if (e.message === "SEO_DUPLICATE") continue; console.log(JSON.stringify({ source: source.title, verification: "not_verified", error: /^SEO_|^SOURCE_|^UNSAFE_/.test(e.message) ? e.message : "SOURCE_UNAVAILABLE" })); }
  }
  const candidates = [
    { name: "Biblioteca Virtual Miguel de Cervantes", url: sources[0].url, assessment: "Pagina consultada: catalogo guiado, ediciones digitales y facsimiles de obras cervantinas. Evaluacion editorial completa pendiente." },
    { name: "Biblioteca Nacional de Espana - Cervantes", url: sources[1].url, assessment: "Pagina consultada: reconstruccion documental de la biblioteca de Cervantes. Evaluacion de una posible propuesta institucional pendiente." },
  ];
  for (const candidate of candidates) {
    try { await saveCollaboration(actor, randomUUID(), 0, { ...candidate, topic: "Cervantes y la cultura escrita del Siglo de Oro", language: "es", country: "Espana", entityType: "Biblioteca digital", relationship: "Recursos documentales para contextualizar la cultura de la Monarquia Hispanica.", contact: "", proposal: "Evaluar un recurso documental compartido o una referencia editorial contextual. No condicionar la colaboracion a reciprocidad.", emailDraft: "", articleSlug: "el-imperio-donde-nunca-se-pone-el-sol", status: "candidate", linkType: "editorial", risks: ["Institucion: no consta que acepte colaboraciones o intercambios de enlaces.", "No se ha contactado ni existe acuerdo."] }); console.log(JSON.stringify({ candidate: candidate.name, status: "candidate" })); }
    catch (e) { if (e.message !== "SEO_DUPLICATE") throw e; }
  }
}
if (process.argv.includes("--test-mail")) {
  const pending = check(await db.from("seo_jobs").select("id,job_key").eq("kind", "notify").in("status", ["pending", "processing", "failed"]));
  const key = "controlled-validation-20261103";
  assert.ok(pending.every(j => j.job_key === `notice:${key}`), "Refuse to send unrelated SEO notices during controlled test");
  const cfg = check(await db.from("seo_engine_config").select("*").eq("id", true).single());
  try {
    await configure({ ...cfg.settings, mailPaused: false }, cfg.revision);
    await ops.queueSeoNotice(actor, key, "[IMPERIO E] Prueba controlada del aviso editorial", "El motor SEO ha preparado esta prueba administrativa. Las notificaciones editoriales llegaran a imperio_e@hotmail.com. Esta prueba no crea ni publica un articulo. La publicacion requiere revisar la version exacta y confirmar la decision desde una sesion administrativa.");
    console.log(JSON.stringify(await ops.runSeoWorker(["notify"])));
    console.log(JSON.stringify(check(await db.from("seo_jobs").select("status,provider_id,delivery_status").eq("job_key", `notice:${key}`).single())));
  } finally { const current = check(await db.from("seo_engine_config").select("revision").eq("id", true).single()); await configure(cfg.settings, current.revision); }
}
if (process.argv.includes("--receipts")) {
  const pending = check(await db.from("seo_jobs").select("id").eq("kind", "notify").in("delivery_status", ["queued", "sent", "accepted_by_provider", "delivery_delayed"]));
  for (const job of pending) check(await db.from("seo_jobs").update({ provider_checked_at: null }).eq("id", job.id));
  const cfg = check(await db.from("seo_engine_config").select("*").eq("id", true).single());
  try { await configure({ ...cfg.settings, mailPaused: false }, cfg.revision); console.log(JSON.stringify(await ops.reconcileSeoMail())); }
  finally { const current = check(await db.from("seo_engine_config").select("revision").eq("id", true).single()); await configure(cfg.settings, current.revision); }
  console.log(JSON.stringify(check(await db.from("seo_jobs").select("job_key,status,provider_id,delivery_status").eq("kind", "notify"))));
}
if (process.argv.includes("--enable-schedule")) {
  const cfg = check(await db.from("seo_engine_config").select("*").eq("id", true).single());
  await configure({ ...cfg.settings, paused: true, mailPaused: false, scheduleEnabled: true, monthlyBudgetCents: 0 }, cfg.revision);
  console.log("SEO scheduling and administrative notifications enabled. Generation remains paused with zero budget.");
}
if (process.argv.includes("--run-schedule")) {
  env.SEO_ENGINE_ENABLED = "true";
  console.log(JSON.stringify(await ops.runSeoWorker(["daily", "weekly", "monthly", "notify"])));
}
