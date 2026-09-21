import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { ARTICLES_ITEMS } from "../src/config/home";
import { ARTICLE_EDITORIAL, AUTHORS, REFERENCE_PAGES, articleEditorialSchema, editorialDate, getArticleEditorial } from "../src/config/editorial";
import { articleSchema, relatedArticles } from "../src/lib/article-seo";
import { canonicalUrl, escapeXml, serializeJsonLd, INDEXABLE_STATIC_ROUTES } from "../src/lib/seo";

test("canonical paths remove queries, fragments and trailing slashes and reject other origins", () => {
  assert.equal(canonicalUrl("/papeles-y-tratados/?q=Felipe#results"), "https://imperioes.com/papeles-y-tratados");
  assert.equal(canonicalUrl("/"), "https://imperioes.com/");
  assert.throws(() => canonicalUrl("https://example.com/path"));
});

test("XML and JSON-LD escape unsafe content without changing values", () => {
  assert.equal(escapeXml('A & B < C "D"'), "A &amp; B &lt; C &quot;D&quot;");
  const data = { headline: "</script><script>bad()</script>" };
  assert.ok(!serializeJsonLd(data).includes("<"));
  assert.deepEqual(JSON.parse(serializeJsonLd(data)), data);
});

test("editorial dates are real and optional fields are not fabricated", () => {
  assert.equal(editorialDate.safeParse("2026-02-30").success, false);
  assert.equal(editorialDate.safeParse("2024-02-29").success, true);
  const fields = articleEditorialSchema.parse({});
  assert.equal(fields.modifiedAt, undefined);
  assert.deepEqual(fields.authorIds, []);
  assert.equal(articleEditorialSchema.safeParse({ bibliography: [{ id: "source", title: "Book", url: "javascript:alert(1)" }] }).success, false);
});

test("all article metadata is public-only and every article has valid related links", () => {
  for (const article of ARTICLES_ITEMS) {
    const schema = articleSchema(article);
    assert.equal(schema.headline, article.title);
    assert.equal(schema.dateModified, ARTICLE_EDITORIAL[article.slug]?.modifiedAt);
    assert.ok(!("articleBody" in schema));
    assert.ok(!("sourceFile" in schema));
    assert.deepEqual(schema.author, [{
      "@type": "Organization",
      name: "Imperio Español",
      url: "https://imperioes.com/autores/imperio-espanol",
    }]);
    assert.deepEqual(getArticleEditorial(article.slug).authorIds, ["imperio-espanol"]);
    assert.ok(article.publishedAt, `${article.slug}: publication date missing`);
    assert.ok(article.description.trim(), `${article.slug}: public description missing`);
    assert.ok(article.lead?.trim(), `${article.slug}: public introduction missing`);
    const links = relatedArticles(article.slug);
    assert.ok(links.length > 0, article.slug);
    assert.ok(links.every(link => link.slug !== article.slug));
    assert.equal(new Set(links.map(link => link.slug)).size, links.length);
    if (article.publishedAt) assert.ok(editorialDate.safeParse(article.publishedAt).success);
    const editorial = ARTICLE_EDITORIAL[article.slug];
    if (!editorial) continue;
    if (editorial.modifiedAt && article.publishedAt) assert.ok(editorial.modifiedAt >= article.publishedAt);
    for (const id of editorial.authorIds) assert.ok(AUTHORS[id], `Unknown author: ${id}`);
    for (const id of editorial.entityIds) assert.ok(REFERENCE_PAGES[id], `Unknown entity: ${id}`);
    const referenceIds = [...editorial.bibliography, ...editorial.primarySources, ...editorial.notes].map(item => item.id);
    assert.equal(new Set(referenceIds).size, referenceIds.length);
  }
});

test("the default editorial author is public and verifiable", () => {
  assert.equal(AUTHORS["imperio-espanol"].type, "Organization");
  assert.equal(AUTHORS["imperio-espanol"].published, true);
  assert.ok(AUTHORS["imperio-espanol"].biography.trim());
});

test("unfinished and private destinations are not in the static sitemap allowlist", () => {
  for (const route of ["/foro", "/archivo", "/comunidad", "/cuenta", "/login", "/registro", "/reservas", "/ensayos"]) {
    assert.ok(!INDEXABLE_STATIC_ROUTES.includes(route));
  }
});

test("reference pages only link existing catalogue entries and do not replace existing routes", () => {
  const slugs = new Set(ARTICLES_ITEMS.map(article => article.slug));
  const reserved = readdirSync("src/pages").filter(name => !name.startsWith("[")).map(name => name.replace(/\.astro$/, ""));
  for (const [id, page] of Object.entries(REFERENCE_PAGES)) {
    assert.ok(!INDEXABLE_STATIC_ROUTES.includes(`/${id}`));
    assert.ok(!reserved.includes(id), `Reserved route: ${id}`);
    for (const slug of page.articleSlugs) assert.ok(slugs.has(slug));
    for (const entity of page.entityIds) assert.ok(REFERENCE_PAGES[entity]);
    if (page.published) assert.doesNotMatch(JSON.stringify(page), /TODO:/);
  }
  for (const [slug, editorial] of Object.entries(ARTICLE_EDITORIAL)) {
    assert.ok(slugs.has(slug), `Unknown article: ${slug}`);
    assert.doesNotMatch(JSON.stringify(editorial), /TODO:/);
  }
  for (const author of Object.values(AUTHORS)) {
    if (author.published) assert.doesNotMatch(JSON.stringify(author), /TODO:/);
  }
});
