import test from "node:test";
import assert from "node:assert/strict";
import { applyGoogleConsent, AUTH_EVENT_STORAGE_KEY, trackConfirmedGoogleAuthEvent } from "../src/lib/google-analytics";
import { CONSENT_KEY } from "../src/lib/cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

test("confirmed auth measurement stays public, consent-bound, minimal and deduplicated", () => {
  const previous = ["window", "document", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const storage = new Map<string, string>();
  const calls: unknown[][] = [], scripts: unknown[] = [];
  const consentAt = new Date(Date.now() - 1000).toISOString();
  const consent = { version: LEGAL_DOCUMENT_VERSIONS.cookies, analytics: true, marketing: false, preferences: false, updatedAt: consentAt };
  const location = new URL("https://imperioes.com/tienda");
  const id = "a".repeat(64), expires = Date.now() + 290000;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    gtag: (...args: unknown[]) => calls.push(args), addEventListener() {} } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "", referrer: "https://imperioes.com/login?next=/admin",
    title: "Tienda", documentElement: { dataset: {} }, createElement: () => ({ dataset: {} }), head: { appendChild: (script: unknown) => scripts.push(script) } } });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async () => new Response(null, { status: 204 }) });
  try {
    applyGoogleConsent(false, "G-VDMP7TKMNY");
    assert.equal(trackConfirmedGoogleAuthEvent("sign_up", "password", consentAt, id, expires), false);
    assert.equal(scripts.length, 0);
    storage.set(CONSENT_KEY, JSON.stringify(consent));
    applyGoogleConsent(true, "G-VDMP7TKMNY", "GTM-5VRFG7ZT");
    location.pathname = "/cuenta";
    assert.equal(trackConfirmedGoogleAuthEvent("login", "password", consentAt, id, expires), false);
    location.pathname = "/tienda";
    assert.equal(trackConfirmedGoogleAuthEvent("sign_up", "password", "different", id, expires), false);
    assert.equal(trackConfirmedGoogleAuthEvent("sign_up", "password", consentAt, id, Date.now() - 1), false);
    assert.equal(trackConfirmedGoogleAuthEvent("purchase", "password", consentAt, id, expires), false);
    storage.set(CONSENT_KEY, JSON.stringify({ ...consent, analytics: false }));
    assert.equal(trackConfirmedGoogleAuthEvent("sign_up", "password", consentAt, id, expires), false);
    storage.set(CONSENT_KEY, JSON.stringify(consent));
    assert.equal(trackConfirmedGoogleAuthEvent("sign_up", "password", consentAt, id, expires), true);
    assert.equal(trackConfirmedGoogleAuthEvent("sign_up", "password", consentAt, id, expires), false);
    const events = calls.filter(call => call[0] === "event" && call[1] === "sign_up");
    assert.equal(events.length, 1);
    assert.deepEqual(events[0][2], { page_location: "https://imperioes.com/tienda", page_referrer: "", page_title: "Tienda", method: "password", send_to: "G-VDMP7TKMNY" });
    assert.equal(JSON.parse(storage.get(AUTH_EVENT_STORAGE_KEY)!)[0].id, id);
    assert.equal(scripts.length, 1);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
