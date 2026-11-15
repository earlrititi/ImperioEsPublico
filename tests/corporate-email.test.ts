import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCorporateEmail, prepareCorporateEmail, validateCorporateMessage, sanitizeEmailBody } from "../src/lib/corporate-email";
import { renderAdminMail } from "../src/lib/admin-mail-template";
import { BRAND } from "../src/config/brand";

test("the blank corporate template has no message, sample content, CTA or unresolved variables and cannot be sent", () => {
  const empty = renderCorporateEmail({ empty: true, subject: "Ignored", bodyText: "Ignored" });
  assert.equal(empty.text, "");
  assert.doesNotMatch(empty.html, /Ignored|\(Asunto\)|Cuerpo|Lorem|\{\{/i);
  assert.match(empty.html, /data-imperio-email-layout="pergamino-v1"/);
  assert.throws(() => prepareCorporateEmail({ subject: "", ...empty }), /EMAIL_SUBJECT_INVALID/);
  assert.throws(() => prepareCorporateEmail({ subject: "Message", ...empty }), /EMAIL_BODY_REQUIRED/);
});

test("a real email keeps its content, signed links, attachments, headers, recipients and subject through one layout", () => {
  const original = { subject: "Compra confirmada", from: "brand@example.test", to: "client@example.test", replyTo: "support@example.test", text: "Pedido #42. Importe: 35 €. Talla: XL.",
    html: '<p>Pedido #42. Importe: 35 €. Talla: XL.</p><a href="https://imperioes.com/pedido?token=a%2Bb%3D&amp;id=42">Ver pedido</a>',
    attachments: [{ filename: "pedido.pdf", path: "https://imperioes.com/pedido.pdf" }], headers: { "List-Unsubscribe": "<https://imperioes.com/comunicaciones/baja?token=real>" } };
  const rendered = prepareCorporateEmail(original);
  assert.equal(rendered.subject, original.subject);
  assert.equal(rendered.to, original.to);
  assert.equal(rendered.replyTo, original.replyTo);
  assert.deepEqual(rendered.attachments, original.attachments);
  assert.deepEqual(rendered.headers, original.headers);
  assert.ok(rendered.text.startsWith(original.text));
  assert.match(rendered.html, /token=a%2Bb%3D&amp;id=42/);
  assert.equal(prepareCorporateEmail(rendered), rendered, "retry snapshots must not be nested/re-rendered");
});

test("missing content, unresolved variables and active or local content are refused before the provider", () => {
  for (const message of [
    { subject: "", text: "Content" }, { subject: "Hello\r\nBcc:other@example.test", text: "Content" },
    { subject: "Content", text: "" }, { subject: "{{subject}}", text: "Content" }, { subject: "Content", text: "{{name}}" },
    { subject: "Content", text: "Cuerpo" }, { subject: "Content", text: "Content", html: '<p>Content</p><img src="data:image/png;base64,AAAA">' },
    { subject: "Content", text: "Content", html: '<p>Content</p><a href="http://localhost:4321">Click</a>' },
    { subject: "Content", text: "Content", html: '<p>Content</p><script>alert(1)</script>' },
  ]) assert.throws(() => prepareCorporateEmail(message));
});

test("HTML fragments are sanitized without destroying safe tables, escaped content and signed links", () => {
  const clean = sanitizeEmailBody('<form><input name=x></form><p onclick="alert(1)">Texto &lt;img&gt;</p><script>alert(1)</script><table><tr><td>35 €</td></tr></table><a href="javascript:alert(1)">Bad</a>');
  assert.doesNotMatch(clean, /<form|<input|<script|onclick|javascript:/);
  assert.match(clean, /Texto &lt;img&gt;/);
  assert.match(clean, /<td>35 €<\/td>/);
});

test("long content remains in normal flow before the corporate footer, with image-free semantic text", () => {
  const paragraphs = Array.from({ length: 20 }, (_, i) => `Párrafo ${i + 1}: atención, & < >. ${"Expedición ".repeat(12)}`);
  const mail = renderAdminMail({ subject: "Una historia extensa", preheader: "", content: paragraphs.join("\n\n"), cta_label: "Ver pedido", cta_url: "https://imperioes.com/mi-cuenta" }, "https://imperioes.com/comunicaciones/baja?token=fixture", true);
  assert.ok(mail.html.indexOf("Párrafo 20") < mail.html.indexOf('class="imperio-legal"'));
  assert.doesNotMatch(mail.html, /position:absolute|max-height:[1-9]|overflow:hidden[^>]*>Párrafo/);
  for (const paragraph of paragraphs) assert.ok(mail.text.includes(paragraph));
  assert.match(mail.text, /Baja: https:\/\/imperioes.com/);
  validateCorporateMessage({ subject: "Una historia extensa", ...mail });
});

test("light and dark email headers use the exact authorized PNG, with one accessible proportionate logo", () => {
  for (const headerTheme of ["light", "dark"] as const) {
    const mail = renderCorporateEmail({ subject: "Pedido QA-42", bodyText: "Importe: 35 €. Referencia: QA-42.", headerTheme });
    assert.ok(mail.html.includes(`src="${BRAND.email.logos[headerTheme]}"`));
    assert.match(mail.html, /data-imperio-brand="official-20261114"/);
    assert.match(mail.html, /width="184" height="184" alt="Imperio Español"/);
    assert.equal((mail.html.match(/<img\b/g) ?? []).length, 1);
    assert.doesNotMatch(mail.html, /\.svg|cabecera-v2|firma-nao-v2|data:image|<script|filter:/i);
    assert.ok(mail.text.includes("Importe: 35 €. Referencia: QA-42."));
    assert.doesNotMatch(mail.html, /Dar de baja/, "service emails do not gain an unsubscribe link");
    validateCorporateMessage({ subject: "Pedido QA-42", ...mail });
  }
});

test("Supabase fallback templates retain confirmation tokens and purposes while using the official PNG", () => {
  for (const [name, purpose, next] of [["confirmation", "email", "%2Fcuenta"], ["recovery", "recovery", "%2Fcuenta%2Fcontrasena"]]) {
    const html = readFileSync(new URL(`../production-environment/supabase/templates/${name}.html`, import.meta.url), "utf8");
    assert.ok(html.includes(`{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&amp;type=${purpose}&amp;next=${next}"`));
    assert.ok(html.includes(`src="${BRAND.email.logos.light}"`));
    assert.match(html, /width="184" height="184" alt="Imperio Español"/);
    assert.doesNotMatch(html, /\.svg|Dar de baja|<script/i);
  }
});

test("SDK senders and the compatibility singleton use the common transport boundary", () => {
  for (const path of ["resend", "admin-mail", "automation-worker", "commerce-mail", "paid-order-admin-mail", "post-delivery-worker", "seo-engine-worker"]) {
    const source = readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), "utf8");
    assert.match(source, /sendCorporateMail\(/, `${path} must send through the validated transport`);
    assert.doesNotMatch(source, /new Resend\(|import\("resend"\)|from "resend"/, `${path} must use the common client factory`);
  }
});
