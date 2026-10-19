import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { ARTICLE_MEDIA_KEY, ARTICLE_MEDIA_LIMIT, prepareArticleImage, readArticleImage } from "../src/lib/article-media";
import { articlePublicationIssues, articleSlug } from "../src/lib/admin-article-editor";
import type { ArticleDraft } from "../src/lib/admin-article-content";

const png = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "red" } }).png().toBuffer();
test("editor uploads are real bounded images, re-encoded as WebP with no input metadata", async () => {
  const input = await sharp(await png()).withExif({ IFD0: { Artist: "Private author" } }).png().toBuffer();
  const image = await prepareArticleImage(input, "image/png"), meta = await sharp(image.bytes).metadata();
  assert.equal(meta.format, "webp"); assert.equal(meta.exif, undefined);
  assert.equal(image.width, 64); assert.equal(image.height, 48);
  assert.ok(image.bytes.byteLength <= ARTICLE_MEDIA_LIMIT);
});
test("editor uploads reject scripts, misleading MIME, corrupt files, excessive size and decompression input", async () => {
  for (const [bytes, mime] of [[Buffer.from('<svg onload="alert(1)"></svg>'), "image/svg+xml"],
    [Buffer.from("not an image"), "image/png"], [await png(), "image/jpeg"],
    [Buffer.alloc(ARTICLE_MEDIA_LIMIT + 1), "image/png"],
    [await sharp({ create: { width: 4001, height: 4001, channels: 3, background: "red" } }).png().toBuffer(), "image/png"]] as const) {
    await assert.rejects(prepareArticleImage(bytes, mime));
  }
});
test("multipart parsing accepts one image only and rejects excess bodies without a Content-Length", async () => {
  const form = new FormData(); form.append("file", new File([await png()], "private-name.png", { type: "image/png" }));
  const image = await readArticleImage(new Request("https://imperioes.com/api/admin/article-media", { method: "POST", body: form }));
  assert.equal(image.width, 64);
  form.append("extra", "unexpected");
  await assert.rejects(readArticleImage(new Request("https://imperioes.com/upload", { method: "POST", body: form })), /INVALID_INPUT/);
  await assert.rejects(readArticleImage(new Request("https://imperioes.com/upload", { method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=fixture" }, body: new Uint8Array(ARTICLE_MEDIA_LIMIT + 65537) })), /IMAGE_TOO_LARGE/);
  await assert.rejects(readArticleImage(new Request("https://imperioes.com/upload", { method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=fixture" }, body: "broken" })), /INVALID_INPUT/);
});
test("public article media names exclude traversal, scripts, original names and other buckets", () => {
  assert.equal(ARTICLE_MEDIA_KEY.test("00000000-0000-4000-8000-000000000001.webp"), true);
  for (const file of ["../private.webp", "photo.svg", "private-name.webp", "..%2Fsecret.webp", "00000000-0000-4000-8000-000000000001.webp?token=secret"]) {
    assert.equal(ARTICLE_MEDIA_KEY.test(file), false);
  }
});
test("new article slugs normalize titles without changing canonical URLs automatically", () => {
  assert.equal(articleSlug("La España de los Austrias: año 1556"), "la-espana-de-los-austrias-ano-1556");
  assert.ok(articleSlug("word ".repeat(100)).length <= 160);
  assert.doesNotMatch(articleSlug(" / ../ <script> "), /[.<>/]/);
});
test("publication reports missing fields and accepts a complete editorial draft", () => {
  const draft = { title: "", publishedAt: "", body: "<p>&nbsp;</p>", seoTitle: "", description: "", imageSrc: "/images/picture.webp", imageAlt: "" } as ArticleDraft;
  assert.deepEqual(articlePublicationIssues(draft), ["Titulo", "Fecha de publicacion", "Contenido", "Titulo SEO", "Descripcion SEO", "Texto alternativo de la imagen principal"]);
  assert.deepEqual(articlePublicationIssues({ ...draft, title: "Title", publishedAt: "2026-10-18", body: "<p>Content</p>",
    seoTitle: "Title", description: "Description", imageAlt: "A documented painting" }), []);
});
