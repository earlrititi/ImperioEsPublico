import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EMAIL_MARKETING_CONSENT,NEWSLETTER_PDF_PATH} from "../src/config/email-marketing";
import {validFunnel} from "../src/lib/funnel";
import {validInteraction} from "../src/lib/interaction-validation";
import {NEWSLETTER_SEGMENTS} from "../src/lib/newsletter-audience";

test("email opt-ins state commercial purposes and never replace the free download",()=>{
  assert.match(EMAIL_MARKETING_CONSENT,/historias.*lanzamientos.*ofertas/);
  const page=readFileSync("src/pages/newsletter.astro","utf8");
  assert.match(page,/Suscribirme y recibir el PDF/);assert.match(page,/Solo descargar el PDF, sin suscribirme/);
  assert.ok(readFileSync("public"+NEWSLETTER_PDF_PATH).subarray(0,4).equals(Buffer.from("%PDF")));
  const registration=readFileSync("src/pages/registro.astro","utf8");
  assert.match(registration,/EMAIL_MARKETING_CONSENT/);assert.doesNotMatch(registration,/<input[^>]*name="newsletter"[^>]*(?:required|checked)/);
});
test("newsletter funnel is consent-gated, bounded and excludes personal URLs",()=>{
  const event={id:"00000000-0000-4000-8000-000000000011",flow:"newsletter",step:4,page:"/newsletter"};
  assert.equal(validFunnel(event),true);assert.equal(validFunnel({...event,step:5}),false);
  assert.equal(validFunnel({...event,page:"/newsletter?email=private@example.com"}),false);
  assert.equal(validInteraction({page:"/newsletter",target:"newsletter-form",event:"click"}),true);
  assert.ok(NEWSLETTER_SEGMENTS.includes("community"));assert.ok(NEWSLETTER_SEGMENTS.includes("newsletter"));
});
