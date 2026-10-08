import test from "node:test";
import assert from "node:assert/strict";
import {sanitizeArticleBody,validateArticleDraft,articleDraftPreview,safeArticleImage} from "../src/lib/admin-article-content";
const draft={title:"El Siglo de Oro",slug:"el-siglo-de-oro",lead:"Resumen",category:"Historia",author:"Imperio E",imageSrc:"",imageAlt:"",imageCaption:"",publishedAt:"2026-10-08",seoTitle:"El Siglo de Oro",description:"Historia",body:"<h2>Literatura</h2><p>Texto</p>"};
test("CMS rejects malformed slugs, dates and oversized content",()=>{
  assert.equal(validateArticleDraft(draft).slug,draft.slug);
  for(const change of [{slug:"../login"},{slug:"Duplicado"},{publishedAt:"2026-02-30"},{body:"x".repeat(200001)},{imageSrc:"https://evil.test/image.jpg"}])assert.throws(()=>validateArticleDraft({...draft,...change}),/INVALID_INPUT/);
});
test("CMS strips scripts, event handlers, external images and dangerous URLs",()=>{
  const clean=sanitizeArticleBody('<h2 onclick="evil()">Titulo</h2><script>secret()</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">Link</a><img src="/images/a.webp" onerror="evil()"><img src="https://evil.test/t.jpg"><svg onload="evil()"></svg>');
  assert.doesNotMatch(clean,/script|onclick|onerror|onload|iframe|svg|javascript:|evil|secret/);
  assert.match(clean,/<h2>Titulo<\/h2>/);assert.match(clean,/src="\/images\/a.webp"/);
});
test("CMS preview treats metadata as text and rejects disguised remote images",()=>{
  assert.doesNotMatch(articleDraftPreview({...draft,title:'<script>alert(1)</script>'}),/<script>/);
  for(const path of ["//evil.test/a.jpg","/images/../a.jpg","/images/%2e%2e/a.jpg","/images/a.svg","/images/a.jpg\" onerror=\"x"])assert.equal(safeArticleImage(path),false);
  assert.equal(safeArticleImage("/images/articulos/example.webp"),true);
});
