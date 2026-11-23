import { validateArticleDraft, type ArticleDraft } from "./admin-article-content";
import { articlePublicationIssues } from "./admin-article-editor";
import { generatedSchema, normalizeSeo, overlap, type Claim, type Opportunity, type Source, type EngineSettings } from "./seo-engine-model";
import { htmlText } from "./seo-engine-http";
import type { InventoryArticle } from "./seo-engine-inventory";

export type Verification = { blockers: string[]; warnings: string[]; claims: Claim[]; contribution: string; automatedOnly: true; checkedAt: string };
export function verifyEditorial(draft: ArticleDraft, claims: Claim[], sources: Source[], contribution: string, inventory: InventoryArticle[]): Verification {
  const blockers: string[] = [], warnings: string[] = [], body = normalizeSeo(htmlText(draft.body));
  if (sources.length < 2 || sources.some(s => s.verification !== "excerpt_matched" || !s.checkedAt || Date.now() - Date.parse(s.checkedAt) > 30 * 86400000)) blockers.push("Se requieren dos fuentes con extractos comprobados en los ultimos 30 dias.");
  if (contribution.length < 40) blockers.push("Falta una contribucion editorial identificable.");
  if (/pendiente de revision/i.test(draft.author)) blockers.push("Confirma la autoria editorial antes de publicar.");
  if (!claims.length) blockers.push("Falta el registro de afirmaciones.");
  const checked = claims.map(claim => {
    const refs = claim.sourceIds.map(id => sources.find(s => s.id === id));
    const matches = refs.length > 0 && refs.every(s => s?.verification === "excerpt_matched" && normalizeSeo(s.excerpt).includes(normalizeSeo(claim.evidence)) && claim.evidence.length >= 25);
    let status = claim.status;
    if (!refs.length || refs.some(s => !s)) status = "unsourced";
    else if (!matches) status = status === "contradictory" ? status : "pending";
    // Textual correspondence is evidence of a passage, not academic fact checking.
    else if (status === "supported") status = "partial";
    if (["pending", "unsourced", "contradictory"].includes(status)) blockers.push(`Afirmacion ${status}: ${claim.text.slice(0, 160)}`);
    if (!body.includes(normalizeSeo(claim.text))) warnings.push(`Revisar correspondencia con el cuerpo: ${claim.text.slice(0, 120)}`);
    return { ...claim, status };
  });
  for (const a of inventory.filter(a => a.slug !== draft.slug)) if (overlap(draft.title, a.title) >= .8) blockers.push(`Posible canibalizacion: ${a.slug}`);
  if (htmlText(draft.body).length < 1200) blockers.push("El desarrollo es insuficiente para la revision de un articulo completo.");
  for (const issue of articlePublicationIssues(draft)) blockers.push(`Campo de publicacion: ${issue}`);
  if (checked.some(c => c.status === "partial")) warnings.push("Los extractos coinciden; el revisor debe comprobar fechas, nombres, atribuciones, contradicciones e interpretaciones.");
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)], claims: checked, contribution, automatedOnly: true, checkedAt: new Date().toISOString() };
}
// Manual editorial workflow: environment credentials never enable a provider.
export function editorialProviderConfig() {
  return { endpoint: "", key: "", model: "", inputRate: 0, outputRate: 0, available: false, mode: "manual" };
}
export function generationPayload(opportunity: Opportunity, sources: Source[], inventory: InventoryArticle[]) {
  return { opportunity, sources: sources.map(({ id, title, author, year, institution, shelfmark, url, excerpt }) => ({ id, title, author, year, institution, shelfmark, url, excerpt })),
    publicContext: inventory.filter(a => opportunity.relatedSlugs.includes(a.slug)).map(a => ({ title: a.title, url: a.url, summary: a.publicText.slice(0, 1200) })) };
}
type GenerationQuote = { model: string; inputRate: number; outputRate: number; inputTokens: number; maxOutputTokens: number; reservedCents: number };
export function quoteGeneration(payload: unknown, settings: EngineSettings): GenerationQuote {
  void [payload, settings];
  throw Error("SEO_MANUAL_MODE");
}
export async function generateEditorial(payload: unknown, quote: GenerationQuote): Promise<never> {
  void [payload, quote];
  throw Error("SEO_MANUAL_MODE");
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function generatedArticle(value: ReturnType<typeof generatedSchema.parse>, sources: Source[], related: InventoryArticle[]): ArticleDraft {
  const references = sources.map(s => `<li><a href="${escape(s.url)}">${escape(s.title)}</a>. ${escape([s.author, s.institution, s.year, s.shelfmark].filter(Boolean).join(". "))}</li>`).join("");
  const links = related.map(a => `<li><a href="${escape(a.url)}">${escape(a.title)}</a></li>`).join("");
  return validateArticleDraft({ ...value, author: "Imperio E (elaboracion asistida por IA; pendiente de revision)", publishedAt: "", imageSrc: "", imageAlt: "", imageCaption: "",
    body: `${value.body}<h2>Fuentes y bibliografia</h2><ul>${references}</ul>${links ? `<h2>Articulos relacionados</h2><ul>${links}</ul>` : ""}` });
}
