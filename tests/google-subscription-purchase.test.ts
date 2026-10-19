import test from "node:test";
import assert from "node:assert/strict";
import { applyGoogleConsent, trackConfirmedGooglePurchase } from "../src/lib/google-analytics";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

test("a first subscription return initializes only after consent and verified receipt, using no private page context", () => {
  const values = new Map<string, string>(), queue: unknown[] = [], scripts: any[] = [];
  const location = new URL("https://www.imperioes.com/gracias?session_id=cs_live_private");
  values.set("imperio_cookie_consent", JSON.stringify({ version: LEGAL_DOCUMENT_VERSIONS.cookies, analytics: true,
    preferences: false, marketing: false, updatedAt: new Date().toISOString() }));
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location, dataLayer: queue, addEventListener() {},
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie: "", title: "Private subscriber",
    referrer: "https://checkout.stripe.com/private", documentElement: { dataset: {} },
    createElement: () => ({ dataset: {} }), head: { appendChild: (script: unknown) => scripts.push(script) } } });
  const receipt = { transaction_id: `ie_${"a".repeat(64)}`, currency: "EUR", value: 31.4, tax: 6.59, shipping: 0,
    items: [{ item_id: "IE-MAESTRE-ANNUAL", item_variant: "maestre-campo-annual", item_category: "Suscripciones", quantity: 1, price: 31.4 }] };
  const commands = () => queue.filter(q => Object.prototype.toString.call(q) === "[object Arguments]").map(q => Array.from(q as IArguments));
  try {
    applyGoogleConsent(true, "G-VDMP7TKMNY", "GTM-5VRFG7ZT");
    assert.equal(trackConfirmedGooglePurchase(receipt), false); assert.equal(scripts.length, 0);
    location.search = "";
    applyGoogleConsent(true, "G-VDMP7TKMNY", "GTM-5VRFG7ZT");
    assert.equal(scripts.length, 0, "clean return without a paid receipt still cannot load tags");
    assert.equal(trackConfirmedGooglePurchase(receipt), true); assert.equal(scripts.length, 1);
    const options = commands().find(c => c[0] === "set")?.[1] as Record<string, unknown>;
    assert.equal(options.page_location, "https://www.imperioes.com/suscribirse");
    assert.equal(options.page_referrer, ""); assert.equal(options.send_page_view, false);
    scripts[0].onload();
    assert.equal(commands().filter(c => c[1] === "purchase").length, 1);
    assert.equal(commands().filter(c => c[1] === "page_view").length, 0);
    assert.doesNotMatch(JSON.stringify(queue), /Private|cs_live|session_id|\/gracias|checkout.stripe.com/);
    assert.equal(trackConfirmedGooglePurchase(receipt), false);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
