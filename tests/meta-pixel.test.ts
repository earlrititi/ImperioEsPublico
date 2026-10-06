import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMetaConsent, canTrackMetaPage, metaCommerceEvent, trackMetaCommerceEvent } from "../src/lib/meta-pixel";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

test("Production CSP permits the consent-gated Pixel and its tracking endpoint", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const policy = config.headers.find((entry: { source: string }) => entry.source === "/(.*)").headers
    .find((header: { key: string }) => header.key === "Content-Security-Policy").value as string;
  const directives = new Map(policy.split(";").map(part => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources];
  }));
  assert.ok(directives.get("script-src")?.includes("https://connect.facebook.net"));
  for (const name of ["img-src", "connect-src"]) {
    assert.ok(directives.get(name)?.includes("https://www.facebook.com/tr/"));
  }
  assert.deepEqual(directives.get("object-src"), ["'none'"]);
  assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
});

test("Meta accepts only public production product and reservation pages", () => {
  assert.equal(canTrackMetaPage("https://imperioes.com/instagram?utm_source=instagram"), true);
  assert.equal(canTrackMetaPage("https://www.imperioes.com/reservas?size=XL"), true);
  for (const path of ["/cuenta", "/admin/comercio", "/reservas/manage", "/suscribirse", "/api/reservations"]) {
    assert.equal(canTrackMetaPage(`https://imperioes.com${path}`), false);
  }
  assert.equal(canTrackMetaPage("http://localhost:4321/instagram"), false);
  assert.equal(canTrackMetaPage("https://preview.vercel.app/instagram"), false);
});

test("Meta refuses private parameters, hashes and sensitive referrers", () => {
  for (const suffix of ["?token=secret", "#token", "?email=a%40b.com", "?utm_term=a%40b.com", "?size=invalid"]) {
    assert.equal(canTrackMetaPage(`https://imperioes.com/reservas${suffix}`), false);
  }
  assert.equal(canTrackMetaPage("https://imperioes.com/instagram", "https://imperioes.com/cuenta"), false);
  assert.equal(canTrackMetaPage("https://imperioes.com/instagram", "https://imperioes.com/reservas?token=private"), false);
  assert.equal(canTrackMetaPage("https://imperioes.com/instagram", "https://www.instagram.com/"), true);
});

test("Free reservations never become Purchase or include customer payloads", () => {
  assert.equal(metaCommerceEvent("reservation_started")?.name, "InitiateCheckout");
  assert.equal(metaCommerceEvent("reservation_completed")?.name, "ReservationCompleted");
  for (const name of ["Purchase", "purchase", "subscription_created", "instagram_reserve_click"]) assert.equal(metaCommerceEvent(name), null);
});

test("SDK stays unloaded before consent, records only public events and stops on revocation", () => {
  let consent: string | null = null;
  const scripts: { onload?: () => void; src?: string; dataset: Record<string, string> }[] = [];
  const calls: unknown[][] = [];
  const fakeWindow = {
    location: { href: "https://imperioes.com/instagram", hostname: "imperioes.com", pathname: "/instagram" },
    localStorage: { getItem: () => consent },
  } as unknown as Window & { fbq: { callMethod?: (...args: unknown[]) => void; queue: unknown[][] } };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    cookie: "", referrer: "", documentElement: { dataset: {} },
    createElement: () => ({ dataset: {} }), head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
  } });
  try {
    applyMetaConsent(false);
    applyMetaConsent(true);
    assert.equal(scripts.length, 0);
    consent = JSON.stringify({ version: LEGAL_DOCUMENT_VERSIONS.cookies, marketing: true,
      analytics: false, preferences: false, updatedAt: new Date().toISOString() });
    applyMetaConsent(true);
    assert.equal(scripts.length, 1);
    assert.match(scripts[0].src!, /^https:\/\/connect.facebook.net\//);
    assert.deepEqual(fakeWindow.fbq.queue[0], ["consent", "revoke"]);
    assert.equal(fakeWindow.fbq.queue[1][2], false);
    fakeWindow.fbq.callMethod = (...args) => { calls.push(args); };
    scripts[0].onload?.();
    assert.equal(calls.filter(call => call[2] === "ViewContent").length, 1);
    applyMetaConsent(true);
    assert.equal(calls.filter(call => call[2] === "PageView").length, 1);
    trackMetaCommerceEvent("reservation_started");
    assert.equal(calls.at(-1)?.[2], "InitiateCheckout");
    consent = null;
    applyMetaConsent(false);
    const count = calls.length;
    trackMetaCommerceEvent("reservation_completed");
    assert.equal(calls.length, count);
    assert.deepEqual(calls.at(-1), ["consent", "revoke"]);
    assert.equal(calls.some(call => call.includes("Purchase")), false);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
