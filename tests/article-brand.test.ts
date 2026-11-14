import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArticleBrand } from "../src/lib/article-brand";
import { BRAND } from "../src/config/brand";

test("old CMS corporate covers use the official asset without mutating stored metadata", () => {
  for (const path of ["/images/logo-redv2.png", "/images/logo-redv2.webp", "/images/logo-redv2-96.webp", "/images/logo-redv2-320.webp", "/images/logo-redv2-480.webp", "/images/imperio-espanol-wordmark.svg"]) {
    const original = { imageSrc: path, imageWidth: 320, imageHeight: 247, title: "Bienvenidos", imageWebpSrcSet: "/images/logo-redv2-320.webp 320w" };
    const normalized = normalizeArticleBrand(original);
    assert.equal(normalized.imageSrc, BRAND.logos.principal.svg);
    assert.ok("brandVariant" in normalized && normalized.brandVariant === "principal");
    assert.equal(normalized.imageWidth, 1254);
    assert.equal(normalized.imageHeight, 1254);
    assert.equal(normalized.imageWebpSrcSet, undefined);
    assert.equal(normalized.title, original.title);
    assert.equal(original.imageSrc, path);
  }
});

test("historical photographs and similarly named files retain their exact metadata", () => {
  for (const imageSrc of ["/images/articulos/Lepanto.webp", "/media/articles/historical-photo.webp", "/images/archive/logo-redv2.png", "https://archive.example/logo-redv2.png"]) {
    const article = { imageSrc, imageWidth: 1200, imageHeight: 800, imageWebpSrcSet: `${imageSrc} 1200w`, brandVariant: undefined };
    assert.equal(normalizeArticleBrand(article), article);
  }
});
