import { z } from "astro/zod";

export const REVIEW_EMAIL = "imperio_e@hotmail.com";
export const normalizeSeo = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const text = (max = 500) => z.string().trim().min(1).max(max);
const date = z.iso.datetime({ offset: true });
const web = z.url().refine(s => { const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443"); });
export const engineSettingsSchema = z.object({
  paused: z.boolean().default(true), mailPaused: z.boolean().default(true), scheduleEnabled: z.boolean().default(false),
  monthlyBudgetCents: z.number().int().min(0).max(10000).default(0),
  maxTokens: z.number().int().min(2000).max(32000).default(10000),
  maxOutputTokens: z.number().int().min(1000).max(8000).default(3000),
  dailyGenerations: z.number().int().min(0).max(5).default(2), weeklyDrafts: z.number().int().min(0).max(4).default(2),
  weeklyImprovements: z.number().int().min(0).max(10).default(3), monthlyCollaborators: z.number().int().min(0).max(20).default(5),
  retentionDays: z.number().int().min(30).max(365).default(90),
}).strict().refine(s => s.maxOutputTokens < s.maxTokens);
export type EngineSettings = z.infer<typeof engineSettingsSchema>;
export const DEFAULT_ENGINE_SETTINGS = engineSettingsSchema.parse({});
export const opportunitySchema = z.object({
  title: text(200), keyword: text(160), intent: text(300), rationale: text(2000), contribution: text(2000),
  category: text(100), relatedSlugs: z.array(text(160)).max(10), sourceIds: z.array(z.uuid()).max(12),
  targetSlug: text(160).nullable().default(null), priority: z.number().int().min(1).max(5).default(3),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
}).strict();
export type Opportunity = z.infer<typeof opportunitySchema>;
export const sourceSchema = z.object({
  title: text(300), url: web, author: z.string().max(300).default(""), year: z.string().max(40).default(""),
  institution: text(200), shelfmark: z.string().max(300).default(""), excerpt: text(4000),
}).strict();
export type Source = z.infer<typeof sourceSchema> & { id: string; checkedAt?: string; digest?: string; verification?: string };
export const claimSchema = z.object({
  text: text(1200), sourceIds: z.array(z.uuid()).max(8), evidence: z.string().max(1500),
  status: z.enum(["supported", "partial", "pending", "contradictory", "unsourced"]),
  kind: z.enum(["fact", "interpretation"]),
}).strict();
export type Claim = z.infer<typeof claimSchema>;
export const generatedSchema = z.object({
  title: text(200), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160), lead: text(1200),
  category: text(100), seoTitle: text(200), description: text(500), body: text(150000),
  contribution: text(2000), claims: z.array(claimSchema).min(1).max(80),
}).strict();
export const collaborationSchema = z.object({
  name: text(200), url: web, topic: text(500), language: text(20).default("es"), country: text(80),
  entityType: text(100), relationship: text(1500), assessment: text(3000), contact: z.string().max(300).default(""),
  proposal: text(4000), emailDraft: z.string().max(6000).default(""), articleSlug: text(160),
  status: z.enum(["candidate", "pending_approval", "approved_to_contact", "contacted", "negotiating", "active", "rejected", "lost"]),
  evidenceUrl: web.optional(), linkTarget: web.optional(),
  linkType: z.enum(["editorial", "sponsored", "ugc", "unendorsed", "contractual"]),
  risks: z.array(text(500)).max(20).default([]),
}).strict();
export const PLATFORMS = ["Google AI Overviews", "Google AI Mode", "ChatGPT Search", "Perplexity", "Gemini", "Microsoft Copilot", "Claude"] as const;
export const observationSchema = z.object({
  platform: z.enum(PLATFORMS), query: text(500), observedAt: date, language: text(20), country: text(80),
  model: z.string().max(100).default(""), response: text(16000), citedUrls: z.array(web).max(40),
  articleSlug: z.string().max(160).default(""), evidenceUrl: web, source: z.enum(["manual", "authorized_import"]),
  declaredPresence: z.enum(["citation", "mention", "absent", "unverifiable"]),
}).strict();
export type Observation = z.infer<typeof observationSchema>;
export function classifyObservation(o: Observation) {
  const linked = o.citedUrls.some(value => ["imperioes.com", "www.imperioes.com"].includes(new URL(value).hostname));
  if (o.declaredPresence === "unverifiable") return "unverifiable";
  if (linked) return "citation";
  return /\bimperio\s+(?:e\b|espa[nñ]ol\b)|imperioes\.com/i.test(o.response) && o.declaredPresence === "mention" ? "mention" : "absent";
}
export function requiredRel(type: z.infer<typeof collaborationSchema>["linkType"]) {
  return ({ editorial: "", sponsored: "sponsored", ugc: "ugc", unendorsed: "nofollow", contractual: "sponsored" })[type];
}
export function overlap(a: string, b: string) {
  const stop = new Set(["de", "la", "el", "los", "las", "del", "en", "y", "que", "un", "una", "por", "para", "como"]);
  const words = (s: string) => new Set(normalizeSeo(s).split(" ").filter(w => w.length > 2 && !stop.has(w)));
  const x = words(a), y = words(b), common = [...x].filter(w => y.has(w)).length;
  return x.size && y.size ? common / Math.min(x.size, y.size) : 0;
}
