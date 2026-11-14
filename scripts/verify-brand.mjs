import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Read-only. Supply localhost or a Vercel preview; never submits forms/orders.
const origin = new URL(process.argv[2] || "http://localhost:4321").origin;
const manifest = JSON.parse(readFileSync("public/brand/manifest.json", "utf8"));
const results = [];
for (const [name, expected] of Object.entries(manifest.files)) {
  const response = await fetch(`${origin}/brand/logos/${name}`);
  assert.equal(response.status, 200, name);
  assert.match(response.headers.get("content-type") || "", name.endsWith(".png") ? /image\/png/ : /image\/svg\+xml/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, name);
  results.push({ path: `/brand/logos/${name}`, status: response.status });
}
for (const path of ["/favicon.svg", "/favicon.ico", "/favicon-16x16.png", "/favicon-32x32.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/site.webmanifest", "/brand/social/imperio-espanol-og.png"]) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, path);
  assert.ok((await response.arrayBuffer()).byteLength > 0, path);
  results.push({ path, status: response.status });
}
for (const path of ["/", "/tienda", "/tienda#camiseta", "/carrito", "/contacto", "/sobre-nosotros", "/newsletter", "/papeles-y-tratados", "/legal/aviso-legal", "/legal/privacidad", "/legal/cookies", "/legal/terminos", "/legal/devoluciones", "/legal/desistimiento", "/legal/envios", "/legal/reservas", "/404", "/500"]) {
  const response = await fetch(origin + path);
  assert.equal(response.status, path === "/404" ? 404 : path === "/500" ? 500 : 200, path);
  const html = await response.text();
  assert.doesNotMatch(html, /logo-redv2|imperio-espanol-footer-interactive|footer-dark-base/, path);
  assert.match(html, /\/brand\/logos\/imperio_es_/, path);
  assert.match(html, /rel="icon"[^>]*image\/svg\+xml/, path);
  assert.doesNotMatch(html, /(?:sk|rk)_live_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/, path);
  if (path === "/") {
    assert.match(html, /https:\/\/imperioes\.com\/brand\/social\/imperio-espanol-og\.png/);
    assert.match(html, /https:\/\/imperioes\.com\/brand\/logos\/imperio_es_principal\.png/);
  }
  results.push({ path, status: response.status });
}
console.log(JSON.stringify({ origin, readOnly: true, checks: results.length, results }, null, 2));
