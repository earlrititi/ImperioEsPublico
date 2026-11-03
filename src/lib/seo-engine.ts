import { randomUUID, createHash } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { database, rpc } from "./reservations";
import { SITE } from "../config/site";
import { ADMIN_USER_IDS } from "./admin-identity";
import { validateArticleDraft, articleDraftPreview } from "./admin-article-content";
import { engineSettingsSchema, opportunitySchema, sourceSchema, collaborationSchema, observationSchema, classifyObservation, requiredRel, normalizeSeo, REVIEW_EMAIL, type Source } from "./seo-engine-model";
import { editorialInventory, duplicateCandidates, improvementOpportunities, knowledgeGraph, geoQueries } from "./seo-engine-inventory";
import { readPublicPage, SOURCE_HOSTS, htmlLinks } from "./seo-engine-http";
import { editorialProviderConfig, generationPayload, quoteGeneration, verifyEditorial } from "./seo-engine-generation";

export const seoFingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
type RecordRow = { id: string; kind: string; data: Record<string, any>; revision: number; created_at: string; updated_at: string };
export async function engineConfiguration() {
  const { data, error } = await (await database()).from("seo_engine_config").select("settings,revision,updated_at,updated_by").eq("id", true).single();
  if (error || !data) throw Error("SEO_MIGRATION_REQUIRED");
  return { ...data, settings: engineSettingsSchema.parse(data.settings) };
}
async function records(kind?: string, limit = 200): Promise<RecordRow[]> {
  let q = (await database()).from("seo_records").select("id,kind,data,revision,created_at,updated_at").order("updated_at", { ascending: false }).limit(limit);
  if (kind) q = q.eq("kind", kind); const { data, error } = await q; if (error) throw Error("DATABASE_UNAVAILABLE"); return data ?? [];
}
async function saveRecord(actor: string, kind: string, id: string, revision: number, data: unknown, fingerprint: string) {
  return rpc("seo_save", { p_actor: actor, p_kind: kind, p_id: id, p_revision: revision, p_data: data, p_fingerprint: seoFingerprint(fingerprint) });
}
async function getRow(table: string, id: string) {
  const { data, error } = await (await database()).from(table).select("*").eq("id", id).single(); if (error || !data) throw Error("SEO_RECORD_NOT_FOUND"); return data;
}
export async function seoDashboard() {
  const config = await engineConfiguration(), db = await database();
  const [inventory, allRecords, opportunities, reviews, jobs] = await Promise.all([
    editorialInventory(), records(undefined, 400),
    db.from("seo_opportunities").select("*").order("updated_at", { ascending: false }).limit(200),
    db.from("seo_reviews").select("id,opportunity_id,article_id,article_revision,status,verification,created_at,reviewer_name,reviewed_at,title:snapshot->>title").order("created_at", { ascending: false }).limit(100),
    db.from("seo_jobs").select("id,kind,job_key,status,attempts,due_at,reserved_cents,actual_cents,input_tokens,output_tokens,error,delivery_status,provider_id,created_at,finished_at").order("created_at", { ascending: false }).limit(150),
  ]);
  for (const r of [opportunities, reviews, jobs]) if (r.error) throw Error("DATABASE_UNAVAILABLE");
  const provider = editorialProviderConfig();
  return { config, inventory, graph: knowledgeGraph(inventory), queries: geoQueries(inventory), opportunities: opportunities.data, reviews: reviews.data, jobs: jobs.data,
    records: allRecords, limited: { records: allRecords.length === 400, opportunities: opportunities.data?.length === 200, reviews: reviews.data?.length === 100, jobs: jobs.data?.length === 150 },
    connections: { generation: provider.available ? "configured" : "not_configured", model: provider.model || null,
      email: Boolean(process.env.RESEND_API_KEY), reviewEmail: REVIEW_EMAIL, searchConsole: Boolean(process.env.SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON || process.env.GA4_SERVICE_ACCOUNT_JSON),
      ga4: Boolean(process.env.GA4_SERVICE_ACCOUNT_JSON), schedule: process.env.SEO_ENGINE_ENABLED === "true", geo: "manual_or_authorized_import" },
  };
}
export async function saveOpportunity(actor: string, id: string, revision: number, input: unknown) {
  const data = opportunitySchema.parse(input), inventory = await editorialInventory();
  if (data.relatedSlugs.some(s => !inventory.some(a => a.slug === s)) || data.targetSlug && !inventory.some(a => a.slug === data.targetSlug)) throw Error("INVALID_INPUT");
  const duplicates = duplicateCandidates(data.title, inventory);
  if (!data.targetSlug && duplicates.length) throw Error("SEO_EXISTING_ARTICLE_REVIEW");
  return saveRecord(actor, "opportunity", id, revision, data, normalizeSeo(data.targetSlug || data.title));
}
export async function saveSource(actor: string, id: string, revision: number, input: unknown) {
  const source = sourceSchema.parse(input), page = await readPublicPage(source.url, SOURCE_HOSTS);
  const matched = normalizeSeo(page.text).includes(normalizeSeo(source.excerpt));
  if (!matched) throw Error("SEO_SOURCE_EXCERPT_NOT_FOUND");
  return saveRecord(actor, "source", id, revision, { ...source, url: page.url, checkedAt: new Date().toISOString(), digest: page.digest, verification: "excerpt_matched" }, page.url);
}
export async function sourceRecords(ids: string[], fresh = false): Promise<Source[]> {
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw Error("SEO_NEEDS_SOURCES");
  const { data, error } = await (await database()).from("seo_records").select("id,data").eq("kind", "source").in("id", ids);
  if (error || data?.length !== ids.length) throw Error("SEO_NEEDS_SOURCES");
  const sources = data.map(row => ({ ...row.data, id: row.id })).sort((a, b) => a.id.localeCompare(b.id)) as Source[];
  if (new Set(sources.map(s => new URL(s.url).href)).size < 2) throw Error("SEO_NEEDS_SOURCES");
  if (fresh) for (const source of sources) {
    const page = await readPublicPage(source.url, SOURCE_HOSTS);
    if (!normalizeSeo(page.text).includes(normalizeSeo(source.excerpt))) throw Error("SEO_SOURCE_CHANGED");
    source.checkedAt = new Date().toISOString(); source.digest = page.digest; source.verification = "excerpt_matched";
  }
  return sources;
}
export async function queueGeneration(actor: string, id: string, revision: number) {
  if (!editorialProviderConfig().available) throw Error("SEO_PROVIDER_NOT_CONFIGURED");
  const config = await engineConfiguration(), row = await getRow("seo_opportunities", id), opportunity = opportunitySchema.parse(row.data);
  if (opportunity.targetSlug) throw Error("SEO_UPDATE_REQUIRES_MANUAL_IMPORT");
  const inventory = await editorialInventory(); if (duplicateCandidates(opportunity.title, inventory).length) throw Error("SEO_EXISTING_ARTICLE_REVIEW");
  const sources = await sourceRecords(opportunity.sourceIds, true), payload = generationPayload(opportunity, sources, inventory), quote = quoteGeneration(payload, config.settings);
  const jobId = await rpc("seo_queue_generation", { p_actor: actor, p_id: id, p_revision: revision, p_reserve: quote.reservedCents, p_payload: { ...quote, opportunity, sources, context: payload } });
  return { jobId, reservedCents: quote.reservedCents };
}
export async function reviewDetail(id: string) {
  const r = await getRow("seo_reviews", id), article = await getRow("cms_articles", r.article_id);
  return { ...r, currentRevision: article.revision, stale: article.revision !== r.article_revision, preview: articleDraftPreview(validateArticleDraft(r.snapshot)) };
}
export async function resubmitReview(actor: string, id: string, revision: number, inputClaims: unknown, contribution: string) {
  const article = await getRow("cms_articles", id), previous = await (await database()).from("seo_reviews").select("opportunity_id").eq("article_id", id).order("article_revision", { ascending: false }).limit(1).single();
  if (previous.error) throw Error("SEO_RECORD_NOT_FOUND");
  const opportunity = opportunitySchema.parse((await getRow("seo_opportunities", previous.data.opportunity_id)).data);
  const sources = await sourceRecords(opportunity.sourceIds, true);
  const { claimSchema } = await import("./seo-engine-model");
  const claims = claimSchema.array().min(1).max(80).parse(inputClaims), draft = validateArticleDraft(article.draft);
  const verification = verifyEditorial(draft, claims, sources, contribution, await editorialInventory());
  return rpc("seo_resubmit_review", { p_actor: actor, p_id: id, p_revision: revision, p_verification: verification, p_sources: sources });
}
export async function decideReview(actor: string, id: string, revision: number, action: string, reviewer: string, note: string, confirmed: boolean) {
  if (!confirmed || !["publish", "reject", "changes"].includes(action) || reviewer.length < 3 || reviewer.length > 150 || note.length < 5 || note.length > 3000) throw Error("INVALID_INPUT");
  const r = await getRow("seo_reviews", id);
  if (action === "publish" && r.status !== "published") {
    const draft = validateArticleDraft(r.snapshot), opportunity = opportunitySchema.parse((await getRow("seo_opportunities", r.opportunity_id)).data);
    const sources = await sourceRecords(opportunity.sourceIds, true);
    const verified = verifyEditorial(draft, r.verification.claims, sources, r.verification.contribution, await editorialInventory());
    if (verified.blockers.length) throw Error("SEO_REVIEW_BLOCKED");
  }
  return rpc("seo_review_action", { p_actor: actor, p_id: id, p_revision: revision, p_action: action, p_name: reviewer, p_note: note });
}
export async function saveCollaboration(actor: string, id: string, revision: number, input: unknown) {
  const data = collaborationSchema.parse(input), inventory = await editorialInventory();
  if (!inventory.some(a => a.slug === data.articleSlug)) throw Error("INVALID_INPUT");
  if (["active", "contacted", "negotiating"].includes(data.status) && !data.evidenceUrl) throw Error("SEO_EVIDENCE_REQUIRED");
  if (revision) {
    const old = await getRow("seo_records", id);
    const allowed: Record<string, string[]> = { candidate: ["candidate", "pending_approval", "rejected"], pending_approval: ["pending_approval", "approved_to_contact", "rejected"], approved_to_contact: ["approved_to_contact", "contacted", "rejected"], contacted: ["contacted", "negotiating", "active", "rejected"], negotiating: ["negotiating", "active", "rejected"], active: ["active", "lost"], lost: ["lost", "pending_approval"], rejected: ["rejected", "candidate"] };
    if (old.kind !== "collaboration" || !allowed[old.data.status]?.includes(data.status)) throw Error("INVALID_STATE");
  } else if (data.status !== "candidate") throw Error("INVALID_STATE");
  return saveRecord(actor, "collaboration", id, revision, { ...data, requiredRel: requiredRel(data.linkType) }, new URL(data.url).hostname);
}
export async function checkCollaboration(actor: string, id: string) {
  const row = await getRow("seo_records", id); if (row.kind !== "collaboration") throw Error("INVALID_INPUT");
  const data = collaborationSchema.parse(Object.fromEntries(Object.entries(row.data).filter(([k]) => !["check", "requiredRel"].includes(k))));
  const page = await readPublicPage(data.url), target = data.linkTarget || `${SITE.url}/papeles-y-tratados/${data.articleSlug}`;
  const links = htmlLinks(page.html, page.url).filter(l => l.url.split("#")[0] === target);
  const rel = requiredRel(data.linkType), verified = links.length > 0 && (!rel || links.some(l => l.rel.split(/\s+/).includes(rel)));
  const check = { checkedAt: new Date().toISOString(), status: page.status, target, found: links.length > 0, verified, rel: links.map(l => l.rel), requiredRel: rel, digest: page.digest };
  return saveRecord(actor, "collaboration", id, row.revision, { ...data, requiredRel: rel, check }, new URL(data.url).hostname);
}
export async function saveObservation(actor: string, id: string, input: unknown) {
  const data = observationSchema.parse(input);
  if (Date.parse(data.observedAt) > Date.now() + 60000) throw Error("INVALID_INPUT");
  const classification = classifyObservation(data);
  if (classification !== data.declaredPresence) throw Error("SEO_OBSERVATION_MISMATCH");
  if (data.articleSlug && !(await editorialInventory()).some(a => a.slug === data.articleSlug)) throw Error("INVALID_INPUT");
  return saveRecord(actor, "observation", id, 0, { ...data, presence: classification, evidenceStatus: "supplied_for_review" }, `${data.platform}:${normalizeSeo(data.query)}:${data.observedAt}:${data.evidenceUrl}`);
}
export async function searchConsoleReport(days = 28) {
  const raw = process.env.SEARCH_CONSOLE_SERVICE_ACCOUNT_JSON || process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return { status: "not_configured", rows: [], source: "search_console_api", aiBreakdown: "not_available_via_this_api" };
  try {
    const c = JSON.parse(raw); if (c.type !== "service_account" || !c.client_email?.endsWith(".iam.gserviceaccount.com") || typeof c.private_key !== "string") throw Error("INVALID_CREDENTIALS");
    const client = await new GoogleAuth({ credentials: { type: "service_account", client_email: c.client_email, private_key: c.private_key }, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] }).getClient();
    const end = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), start = new Date(Date.now() - (days + 2) * 86400000).toISOString().slice(0, 10);
    const result = await client.request<{ rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] }>({ url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent("sc-domain:imperioes.com")}/searchAnalytics/query`, method: "POST", data: { startDate: start, endDate: end, dimensions: ["query", "page"], type: "web", rowLimit: 2500 }, timeout: 15000 });
    const rows = (result.data.rows ?? []).map(row => { if (row.keys.length !== 2 || [row.clicks, row.impressions, row.ctr, row.position].some(n => !Number.isFinite(n) || n < 0)) throw Error("INVALID_REPORT"); return { query: row.keys[0].slice(0, 500), page: row.keys[1], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }; });
    return { status: "available", source: "search_console_api", start, end, rows, limited: rows.length === 2500, aiBreakdown: "not_available_via_this_api" };
  } catch { return { status: "unavailable_check_api_and_property_access", rows: [], source: "search_console_api", aiBreakdown: "not_available_via_this_api" }; }
}
export async function runAudit(actor: string, key = new Date().toISOString().slice(0, 10)) {
  const results: { url: string; ok: boolean; issues: string[]; elapsedMs: number }[] = [];
  for (const path of ["/", "/imperio-espanol", "/politica-editorial", "/sitemap.xml", "/robots.txt", "/tienda"]) {
    const started = Date.now(), url = `${SITE.url}${path}`, issues: string[] = [];
    try {
      if (path.endsWith(".xml")) {
        const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000) }); const body = await r.text();
        if (!r.ok || body.length > 2000000 || !body.includes(`${SITE.url}/imperio-espanol`) || !body.includes("<urlset")) issues.push("Sitemap no valido o sin pagina pilar");
      } else {
        const page = await readPublicPage(url);
        if (path === "/robots.txt") { if (!page.text.includes(`${SITE.url}/sitemap.xml`)) issues.push("Sitemap no declarado en robots"); }
        else {
          if ((page.html.match(/<h1[\s>]/gi) ?? []).length !== 1) issues.push("Revisar H1");
          if (!page.html.includes(`rel="canonical" href="${url}"`) && !page.html.includes(`href="${url}" rel="canonical"`)) issues.push("Revisar canonical");
          if (!/<meta[^>]+name="description"[^>]+content="[^"]{40,}"/i.test(page.html)) issues.push("Revisar descripcion");
          if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(page.html)) issues.push("Noindex inesperado");
          const schemas = [...page.html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
          if (!schemas.length) issues.push("Sin datos estructurados");
          for (const [, json] of schemas) try { JSON.parse(json); } catch { issues.push("JSON-LD invalido"); }
        }
      }
    } catch { issues.push("No se pudo comprobar HTTP"); }
    results.push({ url, ok: !issues.length, issues, elapsedMs: Date.now() - started });
  }
  const data = { checkedAt: new Date().toISOString(), results, critical: results.filter(r => !r.ok).length, performance: "http_timing_only_not_core_web_vitals" };
  return saveRecord(actor, "audit", randomUUID(), 0, data, `audit:${key}`);
}
export async function proposeEditorial(actor: string, key = new Date().toISOString().slice(0, 10)) {
  const inventory = await editorialInventory(), cfg = await engineConfiguration(); let created = 0;
  for (const opportunity of improvementOpportunities(inventory, cfg.settings.weeklyImprovements)) {
    try { await saveOpportunity(actor, randomUUID(), 0, opportunity); created++; } catch (e) { if ((e as Error).message !== "SEO_DUPLICATE") throw e; }
  }
  const gaps = ["Cervantes y la sociedad del Siglo de Oro", "El Consejo de Indias y el gobierno de la Monarquia", "El Galeon de Manila y los intercambios del Pacifico"];
  for (const title of gaps.filter(t => !duplicateCandidates(t, inventory).length).slice(0, 2)) {
    try { await saveOpportunity(actor, randomUUID(), 0, { title, keyword: title, intent: "Explicacion historica documentada", rationale: "Laguna cualitativa del inventario actual; sin volumen de busqueda estimado.", contribution: "Relacionar contexto social e instituciones mediante fuentes primarias verificables.", category: "Sociedad y pensamiento", relatedSlugs: inventory.slice(0, 2).map(a => a.slug), sourceIds: [], targetSlug: null, priority: 3, confidence: "low" }); created++; } catch (e) { if ((e as Error).message !== "SEO_DUPLICATE") throw e; }
  }
  return { key, created, message: created ? "Propuestas guardadas para investigacion." : "No hay oportunidades nuevas suficientemente justificadas." };
}
export async function scheduleEngine() {
  if (process.env.SEO_ENGINE_ENABLED !== "true") return { enabled: false, queued: 0 };
  const cfg = await engineConfiguration(); if (!cfg.settings.scheduleEnabled || !cfg.updated_by) return { enabled: false, queued: 0 };
  return { enabled: true, queued: await rpc("seo_schedule", { p_actor: cfg.updated_by }) };
}
export async function engineActor() {
  const cfg = await engineConfiguration(); return cfg.updated_by || ADMIN_USER_IDS[0];
}
