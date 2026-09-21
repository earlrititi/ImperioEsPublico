import assert from "node:assert/strict";
import test from "node:test";
import { h } from "preact";
import render from "preact-render-to-string";
import ArticleBody from "../src/components/ArticleBody.jsx";

test("legacy third-level section headings become H2 with unique fragment IDs", () => {
  const html = render(h(ArticleBody, { source: "**Title**\n\n### Contexto\n\nText.\n\n### Contexto\n\nMore." }));
  assert.ok(!html.includes("<h1"));
  assert.ok(html.includes('id="section-contexto"'));
  assert.ok(html.includes('id="section-contexto-2"'));
  assert.equal(html.match(/<h2/g)?.length, 2);
});

test("explicit H2/H3 hierarchy is preserved", () => {
  const html = render(h(ArticleBody, { source: "**Title**\n\n## Contexto\n\n### Detalle\n\nText." }));
  assert.equal(html.match(/<h2/g)?.length, 1);
  assert.equal(html.match(/<h3/g)?.length, 1);
});

test("reference markers link only existing notes and escaped text cannot inject HTML", () => {
  const html = render(h(ArticleBody, { source: 'Text[^source] [^missing]\n\n<script>alert(1)</script>\n\n[Contexto](#section-contexto)', noteIds: ["source"] }));
  assert.ok(html.includes('href="#note-source"'));
  assert.ok(!html.includes('href="#note-missing"'));
  assert.ok(html.includes('href="#section-contexto"'));
  assert.ok(!html.includes("<script>"));
});
