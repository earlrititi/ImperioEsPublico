import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGoogleConsent, canTrackGooglePage, googlePageFields, trackGoogleEvent } from "../src/lib/google-analytics";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";
import { INDEXABLE_STATIC_ROUTES } from "../src/lib/seo";
import { ARTICLES_ITEMS } from "../src/config/home";
import { readFileSync, readdirSync } from "node:fs";

test("GA only accepts public production routes and safe campaign parameters", () => {
  for (const path of ["/", "/suscribirse#maestre-de-campo", "/reservas?size=M", "/instagram?utm_source=instagram", "/articulos/la-historia", "/#suscripciones"]) {
    assert.equal(canTrackGooglePage(`https://imperioes.com${path}`), true);
  }
  for (const path of ["/admin/embudo", "/cuenta", "/login", "/registro", "/checkout/camiseta-imperial", "/compra/completada", "/reserva/secret/confirmar", "/reservas/gestionar", "/api/funnel", "/?email=a%40b.com", "/?token=secret", "/?session_id=secret", "/?utm_source=a%40b.com", "/#access_token=secret"]) {
    assert.equal(canTrackGooglePage(`https://imperioes.com${path}`), false, path);
  }
  assert.equal(canTrackGooglePage("http://localhost:4321/"), false);
  assert.equal(canTrackGooglePage("https://preview.vercel.app/"), false);
  assert.equal(canTrackGooglePage("https://www.imperioes.com/"), true);
});

test("GA covers all sitemap static routes and published article metadata on both hosts", () => {
  const paths = [...INDEXABLE_STATIC_ROUTES, ...ARTICLES_ITEMS.map(a=>`/papeles-y-tratados/${a.slug}`),
    "/autores/imperio-espanol", "/reservas", "/biblioteca", "/archivo", "/foro", "/ensayos", "/efemerides", "/presente", "/rutas", "/comunidad"];
  for (const host of ["imperioes.com", "www.imperioes.com"]) {
    for (const path of paths) assert.equal(canTrackGooglePage(`https://${host}${path}`), true, `${host}${path}`);
  }
});

test("every public root template remains covered, including Archive and Forum", () => {
  const privatePages = new Set(["404", "500", "login", "registro", "confirmar-correo", "recuperar-contrasena", "cuenta", "perfil", "suscripcion", "gracias", "gracias-compra"]);
  for (const file of readdirSync("src/pages")) {
    if (!file.endsWith(".astro") || file.startsWith("[")) continue;
    const name = file.slice(0, -6);
    if (privatePages.has(name)) continue;
    assert.equal(canTrackGooglePage(`https://imperioes.com/${name === "index" ? "" : name}`), true, file);
  }
  assert.doesNotMatch(readFileSync("src/components/InWorkPage.astro", "utf8"), /showCookieConsent=\{false\}/);
});

test("public page titles and referrers are sanitized without losing public visits", () => {
  const href = "https://www.imperioes.com/suscribirse?utm_source=instagram#arcabucero";
  const fields = googlePageFields(href, "https://imperioes.com/login?next=/cuenta&token=secret", "Suscripciones | Imperio E")!;
  assert.equal(fields.page_location, "https://www.imperioes.com/suscribirse");
  assert.equal(fields.page_title, "Suscripciones | Imperio E");
  assert.equal(fields.page_referrer, "");
  assert.equal(googlePageFields(href,"https://imperioes.com/instagram?utm_source=instagram#producto")?.page_referrer,"https://imperioes.com/instagram");
  assert.equal(googlePageFields(href,"https://www.google.com/search?q=private@example.com")?.page_referrer,"https://www.google.com");
  assert.equal(googlePageFields(href,"", "Cuenta de private@example.com")?.page_title,"Imperio E");
  assert.equal(googlePageFields("https://imperioes.com/cuenta"),null);
});

test("GA stays unloaded without consent, deduplicates views and stops sending after withdrawal", () => {
  let consent: string | null = null;
  const calls: unknown[][] = [];
  const queue: unknown[] = [];
  queue.push = (...entries: unknown[]) => {
    for (const entry of entries) {
      assert.equal(Object.prototype.toString.call(entry), "[object Arguments]");
      calls.push(Array.from(entry as IArguments));
    }
    return Array.prototype.push.apply(queue, entries);
  };
  const scripts: { src?: string; onload?: () => void; dataset: Record<string, string> }[] = [];
  const location = new URL("https://imperioes.com/instagram?utm_source=instagram#camiseta");
  const fakeWindow = {
    location, localStorage: { getItem: () => consent }, dataLayer: queue,
    addEventListener: (_name: string, callback: (event: {persisted: boolean})=>void) => { restorePage = callback; },
  };
  let restorePage: ((event: {persisted:boolean})=>void) | undefined;
  const fakeDocument = { cookie: "", referrer: "https://imperioes.com/login?token=private", title: "Camiseta Imperial | Imperio E", documentElement: { dataset: {} },
    createElement: () => ({ dataset: {} }), head: { appendChild: (s: typeof scripts[number]) => scripts.push(s) } };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  const id = "G-VDMP7TKMNY";
  try {
    applyGoogleConsent(true, "bad-id");
    applyGoogleConsent(false, id);
    applyGoogleConsent(true, id);
    assert.equal(scripts.length, 0);
    assert.equal(calls[0][1], "default");
    assert.equal(calls.some(c => c[0] === "config" || c[0] === "event"), false);
    consent = JSON.stringify({ version: LEGAL_DOCUMENT_VERSIONS.cookies, analytics: true,
      marketing: false, preferences: false, updatedAt: new Date().toISOString() });
    applyGoogleConsent(true, id);
    applyGoogleConsent(true, id);
    assert.equal(scripts.length, 1);
    assert.equal(calls.filter(c => c[1] === "page_view").length, 1);
    const config = calls.find(c => c[0] === "config")![2] as Record<string, unknown>;
    assert.equal(config.send_page_view, false);
    assert.equal(config.page_location, "https://imperioes.com/instagram");
    assert.equal(config.page_referrer, "");
    assert.equal(config.allow_google_signals, false);
    assert.equal(config.allow_ad_personalization_signals, false);
    assert.equal(config.page_title, fakeDocument.title);
    assert.equal(config.cookie_domain, "imperioes.com");
    restorePage?.({persisted:false});
    assert.equal(calls.filter(c=>c[1]==="page_view").length,1);
    restorePage?.({persisted:true});
    assert.equal(calls.filter(c=>c[1]==="page_view").length,2);
    assert.equal(scripts.length,1);
    trackGoogleEvent("instagram_reserve_click", { size: "M", email: "private@example.com", token: "secret" });
    const event = calls.at(-1)![2] as Record<string, unknown>;
    assert.equal(event.size, "M");
    assert.equal(event.email, undefined);
    assert.equal(event.token, undefined);
    let count = calls.length;
    trackGoogleEvent("purchase", { value: 99 });
    assert.equal(calls.length, count);
    location.pathname = "/cuenta";
    trackGoogleEvent("instagram_product_view");
    assert.equal(calls.length, count);
    location.pathname = "/instagram";
    consent = null;
    applyGoogleConsent(false, id);
    count = calls.length;
    trackGoogleEvent("reservation_completed");
    assert.equal(calls.length, count);
    assert.equal(Reflect.get(fakeWindow, `ga-disable-${id}`), true);
    scripts[0].onload?.();
    assert.equal(calls.filter(c => c[0] === "event").length, 3);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
