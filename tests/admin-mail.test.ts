import test from "node:test";
import assert from "node:assert/strict";
import { renderAdminMail, validateMail } from "../src/lib/admin-mail-template";
import { filterAudience } from "../src/lib/newsletter-audience";
const mail = { subject: "Tu reserva", preheader: "Edicion Imperial", content: "Hola\n\nTu reserva sigue en marcha.", cta_label: "Ver", cta_url: "https://imperioes.com/tienda" };
test("admin email escapes content rather than executing HTML", () => {
  const rendered = renderAdminMail({ ...mail, content: '<img src=x onerror="alert(1)">' });
  assert.ok(!rendered.html.includes("<img")); assert.ok(rendered.html.includes("&lt;img"));
});
test("admin email rejects header injection and offsite CTA", () => {
  assert.throws(() => validateMail({ ...mail, subject: "Hi\r\nBcc:x@example.com" }));
  assert.throws(() => validateMail({ ...mail, cta_url: "https://evil.example" }));
  assert.throws(() => validateMail({ ...mail, cta_url: "javascript:alert(1)" }));
  assert.deepEqual(validateMail(mail), mail);
});

test("automation signature uses the actual brand asset without changing manual emails", () => {
  const rendered = renderAdminMail(mail, "https://imperioes.com/comunicaciones/baja", true);
  assert.match(rendered.html, /https:\/\/imperioes.com\/images\/logo-redv2.png/);
  assert.match(rendered.text, /Un abrazo,\nEquipo de Imperio Espa\u00f1ol/);
  assert.doesNotMatch(renderAdminMail(mail).html, /<img/);
});
test("audiences normalize and deduplicate, excluding only invalid emails and explicit suppression", () => {
  assert.deepEqual(filterAudience([" A@example.com ", "a@example.com", "bad", "b@example.com"], new Set(["b@example.com"])), {
    original: 4, invalid: 1, duplicates: 1, unsubscribed: 1, recipients: ["a@example.com"],
  });
});
