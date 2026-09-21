import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ARTICLES_ITEMS } from "../src/config/home";

const TEXT_ROOT = join(process.cwd(), "src", "data", "article-texts");
const OFFICIAL_CATEGORIES = new Set([
  "La Corona y el Gobierno del Imperio",
  "Expediciones, Rutas y Descubrimientos",
  "La Forja de las Indias",
  "Espada, Mar y Frontera",
  "El Siglo de Oro: Letras, Arte y Pensamiento",
]);
const MASTER_ARTICLE_SLUGS = [
  "cruz-de-borgona-historia",
  "vasallos-monarquia-derechos-deberes-indias",
  "lenguas-indias-monarquia-hispanica",
  "el-espanol-inquebrantable-reputacion-militar",
  "rocroi-1643-mito-fin-tercios",
  "tratado-de-tordesillas-division-del-mundo",
  "garcia-lopez-de-cardenas-gran-canon-1540",
  "cagayan-1582-espanoles-japoneses-piratas",
  "imperio-espanol-e-imperio-britanico",
  "roma-y-la-monarquia-hispanica",
  "magallanes-elcano-primera-vuelta-al-mundo",
  "leyenda-negra-espanola-hablan-los-historiadores",
  "libertadores-americanos-y-espana",
  "comercio-entre-espana-y-las-indias",
  "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
  "cartagena-de-indias-1741-blas-de-lezo",
];
const MASTER_ARTICLES = new Set(MASTER_ARTICLE_SLUGS);

test("responsive article image URLs preserve spaces and resolve every source candidate", () => {
  for (const article of ARTICLES_ITEMS) {
    assert.equal(article.href, `/papeles-y-tratados/${article.slug}`);
    for (const srcset of [
      "imageAvifSrcSet" in article ? article.imageAvifSrcSet : undefined,
      "imageWebpSrcSet" in article ? article.imageWebpSrcSet : undefined,
    ]) {
      if (!srcset) continue;
      for (const candidate of srcset.split(", ")) {
        const match = candidate.match(/^(\S+) (\d+)w$/);
        assert.ok(match, `Invalid source candidate: ${candidate}`);
        assert.ok(existsSync(join("public", decodeURIComponent(match[1]))), candidate);
      }
    }
  }
});

test("article catalogue uses unique slugs and official categories", () => {
  const slugs = ARTICLES_ITEMS.map((article) => article.slug);

  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(
    ARTICLES_ITEMS.every((article) => OFFICIAL_CATEGORIES.has(article.category)),
    "Every article must use one of the five official categories"
  );
});

test("master historical articles include complete production metadata", () => {
  const articlesBySlug = new Map(ARTICLES_ITEMS.map((article) => [article.slug, article]));

  for (const slug of MASTER_ARTICLE_SLUGS) {
    const article = articlesBySlug.get(slug);
    assert.ok(article, `Missing master article: ${slug}`);
    assert.ok(article.seoTitle.length >= 50 && article.seoTitle.length <= 70, `${slug}: SEO title must contain 50-70 characters`);
    assert.ok(article.description.length >= 100, `${slug}: description is too short`);
    assert.ok(article.lead?.length, `${slug}: missing lead`);
    assert.match(article.publishedAt ?? "", /^\d{4}-\d{2}-\d{2}$/, `${slug}: invalid publication date`);
    assert.ok(article.imageAlt.length >= 30, `${slug}: image alt text is too short`);
    assert.ok(article.imageCaption?.length, `${slug}: missing image caption`);
    assert.ok(article.imageSource?.length, `${slug}: missing image source`);
    const imageSourceUrl = "imageSourceUrl" in article ? article.imageSourceUrl : undefined;
    assert.ok(imageSourceUrl?.startsWith("https://"), `${slug}: missing image source URL`);
    assert.ok(article.imageLicense?.length, `${slug}: missing image license`);
    assert.ok((article.relatedSlugs?.length ?? 0) >= 2, `${slug}: missing related articles`);
  }
});

test("article source files, bibliographies, images and relationships resolve", () => {
  const slugs = new Set(ARTICLES_ITEMS.map((article) => article.slug));

  for (const article of ARTICLES_ITEMS) {
    const sourcePath = join(TEXT_ROOT, article.sourceFile);
    assert.ok(existsSync(sourcePath), `${article.slug}: missing source file`);

    const source = readFileSync(sourcePath, "utf8");
    if (MASTER_ARTICLES.has(article.slug)) {
      assert.match(source, /(?:^## |^\*\*)(?:Bibliograf[ií]a|Referencias)/im, `${article.slug}: missing bibliography or references section`);
      const wordCount = source.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
      assert.ok(wordCount >= 1500, `${article.slug}: expected at least 1500 words, found ${wordCount}`);
    }

    const imagePath = join(process.cwd(), "public", decodeURIComponent(article.imageSrc).replace(/^\//, ""));
    assert.ok(existsSync(imagePath), `${article.slug}: missing main image`);

    for (const relatedSlug of article.relatedSlugs ?? []) {
      assert.notEqual(relatedSlug, article.slug, `${article.slug}: self-referencing relationship`);
      assert.ok(slugs.has(relatedSlug), `${article.slug}: unknown related slug ${relatedSlug}`);
    }
  }
});
