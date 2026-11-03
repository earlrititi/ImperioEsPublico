import { ARTICLES_ITEMS } from "../config/home";
import { getArticleTier } from "../config/article-access";
import { getArticleEditorial } from "../config/editorial";
import { database } from "./reservations";
import { canonicalUrl } from "./seo";
import { htmlText, htmlLinks } from "./seo-engine-http";
import { normalizeSeo, overlap, type Opportunity } from "./seo-engine-model";

export type InventoryArticle = {
  id: string | null; slug: string; title: string; category: string; url: string; state: string; tier: string;
  publishedAt: string | null; reviewedAt: string | null; author: string; revision: number; source: "cms" | "file";
  description: string; image: string; entities: string[]; periods: string[]; references: string[];
  links: string[]; issues: string[]; publicText: string;
};
const ENTITIES: [string, string, string][] = [
  ["Carlos V", "person", "siglo XVI"], ["Felipe II", "person", "siglo XVI"], ["Felipe III", "person", "siglo XVII"], ["Felipe IV", "person", "siglo XVII"], ["Carlos II", "person", "siglo XVII"],
  ["Cervantes", "person", "Siglo de Oro"], ["Lope de Vega", "person", "Siglo de Oro"], ["Quevedo", "person", "Siglo de Oro"], ["Velazquez", "person", "Siglo de Oro"],
  ["Lepanto", "event", "siglo XVI"], ["Rocroi", "event", "siglo XVII"], ["Tordesillas", "event", "siglo XV"], ["Flandes", "territory", ""], ["Nueva Espana", "territory", ""], ["Peru", "territory", ""],
  ["Carrera de Indias", "institution", ""], ["Galeon de Manila", "institution", ""], ["Consejo de Indias", "institution", ""], ["Tercios", "institution", ""], ["Monarquia Hispanica", "concept", ""],
];
export function analyzeArticle(meta: { id?: string; slug: string; title: string; category?: string; description?: string; lead?: string; publishedAt?: string; author?: string; imageSrc?: string; editorialReview?: { reviewedAt?: string } }, html: string, state = "published", revision = 0): InventoryArticle {
  const editorial = getArticleEditorial(meta.slug), isPremium = getArticleTier(meta.slug) !== "piquero";
  const plain = htmlText(html), visible = isPremium ? `${meta.title} ${meta.lead ?? ""} ${meta.description ?? ""}` : plain;
  const haystack = ` ${normalizeSeo(`${meta.title} ${visible}`)} `;
  const entities = ENTITIES.filter(([label]) => haystack.includes(` ${normalizeSeo(label)} `));
  const links = htmlLinks(html, canonicalUrl(`/papeles-y-tratados/${meta.slug}`));
  const references = [...new Set([...editorial.primarySources, ...editorial.bibliography].map(s => s.url ?? s.title).concat(links.filter(l => new URL(l.url).hostname !== "imperioes.com").map(l => l.url)))];
  const issues: string[] = [];
  if (!meta.description || meta.description.length < 80) issues.push("Metadata breve o ausente");
  if (!meta.lead || meta.lead.length < 100) issues.push("Revisar respuesta directa y contexto");
  if (!references.length) issues.push("Revisar bibliografia y trazabilidad de fuentes");
  if (links.filter(l => new URL(l.url).hostname === "imperioes.com").length < 2) issues.push("Revisar enlaces internos");
  if (!isPremium && !/<h[23]\b/i.test(html)) issues.push("Revisar estructura de secciones");
  if (!meta.editorialReview?.reviewedAt && !editorial.modifiedAt) issues.push("No consta fecha de revision historica");
  if (isPremium) issues.push("Analisis publico limitado a metadatos; texto protegido excluido del contexto IA");
  return { id: meta.id ?? null, slug: meta.slug, title: meta.title, category: meta.category ?? "", url: canonicalUrl(`/papeles-y-tratados/${meta.slug}`), state,
    tier: getArticleTier(meta.slug), publishedAt: meta.publishedAt ?? null, reviewedAt: meta.editorialReview?.reviewedAt ?? editorial.modifiedAt ?? null, author: meta.author ?? "Imperio Espanol", revision, source: meta.id ? "cms" : "file",
    description: meta.description ?? "", image: meta.imageSrc ?? "", entities: entities.map(([name]) => name), periods: [...new Set(entities.map(([, , period]) => period).filter(Boolean))],
    references, links: [...new Set(links.map(l => l.url))], issues, publicText: visible.slice(0, 6000) };
}
export async function editorialInventory() {
  const db = await database();
  const records: { id: string; slug: string; status: string; revision: number; draft: Record<string, string>; published_meta: Record<string, string> | null; published_body: string | null }[] = [];
  for (let offset = 0; ; offset += 500) { const r = await db.from("cms_articles").select("id,slug,status,revision,draft,published_meta,published_body").order("id").range(offset, offset + 499); if (r.error) throw Error("DATABASE_UNAVAILABLE"); records.push(...r.data); if (r.data.length < 500) break; }
  const items: InventoryArticle[] = [];
  const { loadArticleSource } = await import("./article-content");
  for (const legacy of ARTICLES_ITEMS) {
    const managed = records.find(r => r.slug === legacy.slug);
    if (managed?.published_meta || managed?.status === "withdrawn" || managed?.status === "deleted") continue;
    const raw = await loadArticleSource(legacy.sourceFile);
    const html = raw.replace(/^#{1,3}\s+(.+)$/gm, "<h2>$1</h2>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
    items.push(analyzeArticle({ ...legacy, id: managed?.id }, html, "published", managed?.revision));
  }
  for (const row of records) {
    if (row.status !== "published" || !row.published_meta) continue;
    items.push(analyzeArticle({ ...row.published_meta, id: row.id, slug: row.slug, title: row.published_meta.title }, row.published_body ?? "", row.status, row.revision));
  }
  return items;
}
export function knowledgeGraph(items: InventoryArticle[]) {
  return items.flatMap(a => [
    ...a.entities.map(entity => ({ from: a.slug, relation: "mentions", to: entity, basis: "public_text_match" })),
    ...a.periods.map(period => ({ from: a.slug, relation: "period_candidate", to: period, basis: "entity_dictionary_inference" })),
    ...a.references.map(source => ({ from: a.slug, relation: "references", to: source, basis: "existing_reference" })),
  ]);
}
export function duplicateCandidates(title: string, items: InventoryArticle[]) {
  return items.map(a => ({ slug: a.slug, title: a.title, score: overlap(title, a.title) })).filter(a => a.score >= 0.65).sort((a, b) => b.score - a.score);
}
export function improvementOpportunities(items: InventoryArticle[], limit: number): Opportunity[] {
  return items.filter(a => a.issues.length >= 3).sort((a, b) => b.issues.length - a.issues.length).slice(0, limit).map(a => ({
    title: `Revision editorial: ${a.title}`.slice(0, 200), keyword: a.title.slice(0, 160), intent: "Ampliar y documentar una pagina existente", rationale: a.issues.join(". "),
    contribution: "Propuesta de mejora; requiere investigacion documental y revision humana.", category: a.category, relatedSlugs: [a.slug], sourceIds: [], targetSlug: a.slug, priority: 3, confidence: "low",
  }));
}
export function geoQueries(items: InventoryArticle[]) {
  return [{ slug: "", query: "Que fue el Imperio espanol y cuales son sus fuentes historicas?" }, ...items.slice(0, 40).map(a => ({ slug: a.slug, query: `Que fuentes y contexto historico explican ${a.title.replace(/[?.!]+$/, "")}?`.slice(0, 500) }))];
}
