import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import booklet from "../src/config/siglo-de-oro.json";
import { AUTOMATION_DEFAULTS } from "../src/lib/email-automations";
import { canTrackGooglePage } from "../src/lib/google-analytics";

test("The welcome resource has seven sourced stories and a matching downloadable PDF", () => {
  assert.equal(booklet.stories.length, 7);
  assert.equal(new Set(booklet.stories.map(story => story.id)).size, 7);
  const institutions = ["www.bne.es", "biblioteca.ugr.es", "asclepio.revistas.csic.es", "www.cultura.gob.es", "www.galeriadelascoleccionesreales.es"];
  for (const story of booklet.stories) {
    assert.ok(institutions.includes(new URL(story.source.url).hostname));
    assert.match(story.source.url, /^https:\/\//);
    assert.equal(story.paragraphs.length, 2);
    assert.ok(story.paragraphs.every(paragraph => paragraph.length > 150));
  }
  const pdf = readFileSync(new URL("../public/recursos/7-historias-del-siglo-de-oro.pdf", import.meta.url));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.byteLength > 10000 && pdf.byteLength < 1000000);
  const page = readFileSync(new URL("../src/pages/recursos/7-historias-del-siglo-de-oro.astro", import.meta.url), "utf8");
  assert.match(page, /booklet\.stories\.map/);
  assert.match(page, /source\.url/);
  assert.match(page, /7-historias-del-siglo-de-oro\.pdf/);
  assert.match(page, /noindex/);
  assert.equal(canTrackGooglePage("https://imperioes.com/recursos/7-historias-del-siglo-de-oro"), true);
  assert.equal(canTrackGooglePage("https://imperioes.com/recursos/7-historias-del-siglo-de-oro?email=private@example.invalid"), false);
  assert.equal(AUTOMATION_DEFAULTS.find(item => item.key === "welcome")?.steps[0].mail.cta_url,
    "https://imperioes.com/recursos/7-historias-del-siglo-de-oro");
});
