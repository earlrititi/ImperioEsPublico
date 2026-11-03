import test from "node:test";
import assert from "node:assert/strict";
import { sourceSchema, observationSchema, classifyObservation, requiredRel, overlap, DEFAULT_ENGINE_SETTINGS } from "../src/lib/seo-engine-model";
import { isPublicAddress, publicUrl, htmlLinks, htmlText } from "../src/lib/seo-engine-http";
import { analyzeArticle, duplicateCandidates, geoQueries } from "../src/lib/seo-engine-inventory";
import { generatedArticle, verifyEditorial, quoteGeneration, editorialProviderConfig } from "../src/lib/seo-engine-generation";
import { reviewMail } from "../src/lib/seo-engine-worker";
import { sanitizeArticleBody } from "../src/lib/admin-article-content";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
const sources = ids.map((id, i) => ({ id, title: `Documento ${i + 1}`, url: `https://www.bne.es/documento-${i}`, institution: "Biblioteca Nacional", author: "", year: "", shelfmark: "", excerpt: "El testimonio documental conserva una descripcion del contexto historico y su administracion.", checkedAt: new Date().toISOString(), digest: "a".repeat(64), verification: "excerpt_matched" }));
const generated = { title: "Instituciones documentadas del Siglo de Oro", slug: "instituciones-documentadas", lead: "Una introduccion documental al contexto social y administrativo de la Monarquia.", category: "Sociedad", seoTitle: "Instituciones documentadas del Siglo de Oro", description: "Una descripcion contextual de instituciones y sociedad a partir de fuentes documentales, con revision editorial y referencias comprobables.", body: `<h2>Contexto</h2><p>${"El testimonio documental conserva una descripcion del contexto historico y su administracion. ".repeat(20)}</p><script>alert(1)</script>`, contribution: "Una comparacion documental identificable del contexto social y las instituciones.", claims: [{ text: "El testimonio documental conserva una descripcion del contexto historico y su administracion.", sourceIds: ids, evidence: "El testimonio documental conserva una descripcion del contexto historico y su administracion.", status: "supported" as const, kind: "fact" as const }] };

test("SSRF rejects local, reserved, mapped IPv6 and non-HTTPS destinations", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00:1::", "2001:2::1", "2001:0000::1"]) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("8.8.8.8"), true); assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  for (const url of ["http://bne.es", "https://127.0.0.1", "https://localhost/", "https://user:password@bne.es", "https://bne.es:444/", "https://bne.es.evil.invalid"]) assert.throws(() => publicUrl(url, ["bne.es"]));
  assert.equal(publicUrl("https://www.bne.es/documento", ["bne.es"]).hostname, "www.bne.es");
});
test("HTML extraction excludes scripts and resolves links structurally", () => {
  assert.equal(htmlText("<p>Documento</p><script>private()</script>"), "Documento");
  const links = htmlLinks('<a href="/pagina?a=1&amp;b=2" rel="sponsored">Fuente</a>', "https://imperioes.com");
  assert.equal(links[0].url, "https://imperioes.com/pagina?a=1&b=2"); assert.equal(links[0].rel, "sponsored");
  assert.deepEqual(htmlLinks('<a id="section">Sin enlace</a>', "https://imperioes.com"), []);
});
test("premium content never enters the IA public context", () => {
  const article = analyzeArticle({ slug: "premium-no-publico", title: "Felipe III", lead: "Resumen publico", description: "Descripcion publica" }, "<p>SECRETO_PREMIUM Felipe II</p>");
  assert.doesNotMatch(article.publicText, /SECRETO_PREMIUM/); assert.deepEqual(article.entities, ["Felipe III"]);
  assert.equal(article.reviewedAt, null); assert.equal(article.publishedAt, null);
});
test("opportunities and GEO queries use real inventory with duplicate detection", () => {
  const a = analyzeArticle({ slug: "monarquia-hispanica", title: "Monarquia Hispanica y sus instituciones" }, "");
  assert.equal(duplicateCandidates("Las instituciones de la Monarquia Hispanica", [a]).length, 1);
  assert.equal(geoQueries([a])[1].slug, a.slug); assert.ok(overlap("Consejo de Indias", "Historia del Consejo de Indias") > .9);
});
test("source identifiers and safe URLs must be explicitly supplied", () => {
  assert.throws(() => sourceSchema.parse({ title: "Fuente", institution: "Archivo", excerpt: "Texto", url: "javascript:alert(1)" }));
  assert.equal(sourceSchema.parse({ title: sources[0].title, institution: sources[0].institution, excerpt: sources[0].excerpt, url: sources[0].url }).author, "");
});
test("generation sanitizes HTML and requires real editorial fields before publication", () => {
  const draft = generatedArticle(generated, sources, []);
  assert.doesNotMatch(draft.body, /<script/); assert.match(draft.body, /Fuentes y bibliografia/); assert.equal(draft.publishedAt, "");
  const verification = verifyEditorial(draft, generated.claims, sources, generated.contribution, []);
  assert.ok(verification.blockers.length > 0); assert.equal(verification.claims[0].status, "partial");
  const complete = { ...draft, author: "Imperio E", publishedAt: "2026-11-03" };
  assert.deepEqual(verifyEditorial(complete, generated.claims, sources, generated.contribution, []).blockers, []);
});
test("missing, contradictory and unsupported claims block publication", () => {
  const draft = { ...generatedArticle(generated, sources, []), author: "Imperio E", publishedAt: "2026-11-03" };
  for (const claim of [{ ...generated.claims[0], status: "contradictory" as const }, { ...generated.claims[0], sourceIds: [] }, { ...generated.claims[0], evidence: "Cita que no existe en la fuente documental" }]) assert.ok(verifyEditorial(draft, [claim], sources, generated.contribution, []).blockers.length > 0);
});
test("GEO requires observed evidence and distinguishes domain citations from mentions", () => {
  const o = observationSchema.parse({ platform: "ChatGPT Search", query: "Que fue el Imperio?", observedAt: "2026-11-03T00:00:00Z", language: "es", country: "ES", response: "Referencia a Imperio E", citedUrls: ["https://imperioes.com/imperio-espanol"], evidenceUrl: "https://chatgpt.com/share/observacion", source: "manual", declaredPresence: "citation" });
  assert.equal(classifyObservation(o), "citation");
  assert.equal(classifyObservation({ ...o, citedUrls: ["https://imperioes.com.evil.example/"], declaredPresence: "mention" }), "mention");
  assert.equal(classifyObservation({ ...o, citedUrls: [], response: "El Imperio espanol fue una monarquia", declaredPresence: "absent" }), "absent");
  assert.equal(classifyObservation({ ...o, declaredPresence: "unverifiable" }), "unverifiable");
});
test("collaboration link attributes reflect the actual relationship", () => {
  assert.equal(requiredRel("editorial"), ""); assert.equal(requiredRel("sponsored"), "sponsored"); assert.equal(requiredRel("contractual"), "sponsored"); assert.equal(requiredRel("ugc"), "ugc"); assert.equal(requiredRel("unendorsed"), "nofollow");
  const html = sanitizeArticleBody('<p><a href="https://example.com/recurso" rel="sponsored nofollow ugc opener">Recurso</a></p>');
  assert.match(html, /rel="noopener noreferrer sponsored nofollow ugc"/); assert.doesNotMatch(html, /\sopener[\s"]/);
});
test("budget starts paused and an unconfigured provider cannot consume money", () => {
  const saved = { ...process.env };
  try { delete process.env.SEO_AI_API_KEY; delete process.env.SEO_AI_MODEL; assert.equal(editorialProviderConfig().available, false); assert.throws(() => quoteGeneration({}, DEFAULT_ENGINE_SETTINGS), /SEO_PROVIDER_NOT_CONFIGURED/);
    Object.assign(process.env, { SEO_AI_API_KEY: "fixture", SEO_AI_MODEL: "fixture-model", SEO_AI_INPUT_CENTS_PER_MILLION: "100", SEO_AI_OUTPUT_CENTS_PER_MILLION: "400" });
    const q = quoteGeneration({}, DEFAULT_ENGINE_SETTINGS); assert.ok(q.reservedCents > 0); assert.throws(() => quoteGeneration({ source: "x".repeat(40000) }, DEFAULT_ENGINE_SETTINGS), /SEO_CONTEXT_LIMIT/);
  } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
  assert.equal(DEFAULT_ENGINE_SETTINGS.paused, true); assert.equal(DEFAULT_ENGINE_SETTINGS.monthlyBudgetCents, 0);
});
test("review notices always go to the editorial address and GET links only open the private review", () => {
  const mail = reviewMail({ id: ids[0], snapshot: { title: "Revision de prueba", category: "Historia", lead: "Resumen" }, source_snapshot: sources, verification: { blockers: [], warnings: [] } }, { keyword: "Historia", relatedSlugs: [] });
  assert.equal(mail.to, "imperio_e@hotmail.com"); assert.match(mail.text, /\/admin\/seo\?review=/); assert.doesNotMatch(mail.text, /action=publish|approve_token/);
});
