import test from "node:test";
import assert from "node:assert/strict";
import { applyGoogleConsent, trackGoogleCommerce } from "../src/lib/google-analytics";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

test("GTM uses basic consent, one container, no second direct GA SDK and revocable ecommerce", () => {
  let consent: string | null = null;
  const queue: unknown[] = [], scripts: any[] = [];
  const fakeWindow = { location: new URL("https://imperioes.com/carrito"), localStorage: { getItem: () => consent }, dataLayer: queue, addEventListener() {} };
  const fakeDocument = { cookie: "", referrer: "", title: "Carrito | Imperio E", documentElement: { dataset: {} }, createElement: () => ({ dataset: {} }), head: { appendChild: (s: unknown) => scripts.push(s) } };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
  Object.defineProperty(globalThis, "document", { value: fakeDocument, configurable: true });
  const id = "G-VDMP7TKMNY", gtm = "GTM-5VRFG7ZT";
  try {
    applyGoogleConsent(false, id, gtm);
    assert.equal(scripts.length, 0);
    assert.equal(trackGoogleCommerce("add_to_cart", [{ size: "M", quantity: 1 }]), false);
    consent = JSON.stringify({ version: LEGAL_DOCUMENT_VERSIONS.cookies, preferences: false, analytics: true, marketing: false, updatedAt: new Date().toISOString() });
    applyGoogleConsent(true, id, gtm); applyGoogleConsent(true, id, gtm);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtm.js?id=${gtm}`);
    assert.equal(trackGoogleCommerce("add_to_cart", [{ size: "M", quantity: 2 }]), true);
    const commands = queue.filter(q => Object.prototype.toString.call(q) === "[object Arguments]").map(q => Array.from(q as IArguments));
    assert.equal(commands.filter(q => q[0] === "event" && q[1] === "page_view").length, 1);
    assert.equal(commands.filter(q => q[0] === "config").length, 0);
    assert.equal(commands.find(q => q[0] === "event" && q[1] === "add_to_cart")?.[2].value, 53.98);
    assert.ok(commands.filter(q => q[0] === "consent").every(q => q[2].ad_storage === "denied" && q[2].ad_user_data === "denied" && q[2].ad_personalization === "denied"));
    consent = null; applyGoogleConsent(false, id, gtm);
    assert.equal(trackGoogleCommerce("add_to_cart", [{ size: "M", quantity: 1 }]), false);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
