import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { FREE_ARTICLE_SLUGS, getArticleTier } from "../src/config/article-access";
import { ARTICLES_ITEMS } from "../src/config/home";
import { canAccessContentTier } from "../src/lib/subscriptions";
import { hasPublishedPaidContent } from "../src/lib/commercial-readiness";

test("only the six original articles are free, independent of catalogue order", () => {
  const free = ARTICLES_ITEMS.filter(a => getArticleTier(a.slug) === "piquero");
  assert.equal(free.length, 6);
  assert.deepEqual(new Set(free.map(a => a.slug)), new Set(FREE_ARTICLE_SLUGS));
  assert.equal(getArticleTier("leyenda-negra-espanola-hablan-los-historiadores"), "arcabucero");
  assert.equal(getArticleTier("new-future-article"), "arcabucero");
  for (const a of [...ARTICLES_ITEMS].reverse()) {
    assert.equal(getArticleTier(a.slug) === "piquero", free.some(f => f.slug === a.slug));
  }
});

test("both paid plans share every premium article for monthly and annual members", () => {
  for (const article of ARTICLES_ITEMS) {
    const tier = getArticleTier(article.slug);
    for (const plan of ["arcabucero", "maestre_campo", "maestre-de-campo"]) {
      for (const billing_interval of ["month", "year"]) {
        for (const status of ["active", "trialing"]) {
          const subscription = { plan, status, billing_interval };
          assert.equal(canAccessContentTier(tier, subscription), true);
        }
      }
    }
  }
});

test("anonymous, free, canceled and unpaid visitors never receive premium access", () => {
  for (const article of ARTICLES_ITEMS) {
    const tier = getArticleTier(article.slug);
    const expected = tier === "piquero";
    assert.equal(canAccessContentTier(tier, {}), expected);
    assert.equal(canAccessContentTier(tier, { plan: "piquero", status: "active" }), expected);
    for (const plan of ["arcabucero", "maestre_campo"]) {
      for (const status of ["canceled", "unpaid", "past_due", "incomplete", "incomplete_expired", "paused", null]) {
        assert.equal(canAccessContentTier(tier, { plan, status }), expected);
      }
    }
    assert.equal(canAccessContentTier(tier, { plan: "unrecognized", status: "active" }), expected);
  }
});

test("published private article sources satisfy the content gate for both paid plans", () => {
  const tiers = ARTICLES_ITEMS.map(a => {
    assert.ok(existsSync(join(process.cwd(), "src/data/article-texts", a.sourceFile)));
    return getArticleTier(a.slug);
  });
  assert.equal(hasPublishedPaidContent(tiers, "arcabucero"), true);
  assert.equal(hasPublishedPaidContent(tiers, "maestre_campo"), true);
});

test("article bodies are not public files and the route cannot be prerendered", () => {
  assert.equal(existsSync(join(process.cwd(), "public/images/articulos/textos")), false);
  const route = readFileSync(join(process.cwd(), "src/pages/papeles-y-tratados/[slug].astro"), "utf8");
  assert.match(route, /export const prerender = false/);
  assert.match(route, /hasAccess \? await loadArticleSource/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(route, /client:(?:load|visible|idle).*ArticleBody/);
});
