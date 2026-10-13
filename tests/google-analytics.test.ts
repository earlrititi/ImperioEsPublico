import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGoogleConsent, canTrackGooglePage, trackGoogleEvent } from "../src/lib/google-analytics";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

test("GA only accepts public production routes and safe campaign parameters", () => {
  for (const path of ["/", "/reservas?size=M", "/instagram?utm_source=instagram", "/articulos/la-historia", "/#suscripciones"]) {
    assert.equal(canTrackGooglePage(`https://imperioes.com${path}`), true);
  }
  for (const path of ["/admin/embudo", "/cuenta", "/login", "/registro", "/checkout/camiseta-imperial", "/suscribirse", "/compra/completada", "/reserva/secret/confirmar", "/reservas/gestionar", "/api/funnel", "/?email=a%40b.com", "/?token=secret", "/?session_id=secret", "/?utm_source=a%40b.com", "/#access_token=secret"]) {
    assert.equal(canTrackGooglePage(`https://imperioes.com${path}`), false, path);
  }
  assert.equal(canTrackGooglePage("http://localhost:4321/"), false);
  assert.equal(canTrackGooglePage("https://preview.vercel.app/"), false);
  assert.equal(canTrackGooglePage("https://imperioes.com/", "https://imperioes.com/cuenta"), false);
  assert.equal(canTrackGooglePage("https://imperioes.com/", "https://example.com/?token=secret"), false);
  assert.equal(canTrackGooglePage("https://www.imperioes.com/", "https://www.google.com/"), true);
});

test("GA stays unloaded without consent, deduplicates views and stops sending after withdrawal", () => {
  let consent: string | null = null;
  const calls: unknown[][] = [];
  const scripts: { src?: string; onload?: () => void; dataset: Record<string, string> }[] = [];
  const location = new URL("https://imperioes.com/instagram?utm_source=instagram#camiseta");
  const fakeWindow = {
    location, localStorage: { getItem: () => consent }, gtag: (...args: unknown[]) => calls.push(args),
  };
  const fakeDocument = { cookie: "", referrer: "", documentElement: { dataset: {} },
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
    assert.equal(calls.filter(c => c[0] === "event").length, 2);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
