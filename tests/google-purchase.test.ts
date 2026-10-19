import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyGoogleConsent, googlePurchasePageFields, PURCHASE_STORAGE_KEY, trackConfirmedGooglePurchase } from "../src/lib/google-analytics";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

const receipt = { transaction_id: `ie_${"a".repeat(64)}`, currency: "EUR", value: 22.31, tax: 5.20, shipping: 2.48,
  items: [{ item_id: "IE-CAMISETA-IMPERIAL-M", item_variant: "M", quantity: 1, price: 22.31 }] };

test("only the clean payment return accepts a purchase context, not other private pages or secrets", () => {
  for (const host of ["imperioes.com", "www.imperioes.com"]) {
    assert.deepEqual(googlePurchasePageFields(`https://${host}/compra/completada`), {
      page_location: `https://${host}/tienda`, page_referrer: "", page_title: "Camiseta Imperial | Imperio E" });
  }
  for (const host of ["imperioes.com", "www.imperioes.com"]) {
    assert.deepEqual(googlePurchasePageFields(`https://${host}/gracias`), {
      page_location: `https://${host}/suscribirse`, page_referrer: "", page_title: "Suscripciones | Imperio E" });
  }
  for (const path of ["/cuenta", "/reservas/gestionar", "/tienda", "/gracias?session_id=secret", "/gracias#private.token", "/compra/completada?session_id=secret", "/compra/completada#private.token"]) {
    assert.equal(googlePurchasePageFields(`https://imperioes.com${path}`), null);
  }
  assert.equal(googlePurchasePageFields("http://localhost:4321/compra/completada"), null);
  assert.equal(googlePurchasePageFields("https://preview.vercel.app/compra/completada"), null);
});

test("purchase waits for loaded tags and consent, has no page view/PII and deduplicates persistently", () => {
  const storage = new Map<string, string>();
  const queue: unknown[] = [], scripts: any[] = [];
  const location = new URL("https://imperioes.com/compra/completada");
  const fakeWindow = { location, dataLayer: queue, addEventListener() {}, localStorage: {
    getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) } };
  const fakeDocument = { cookie: "", title: "Private customer", referrer: "https://imperioes.com/reservas/gestionar?token=secret", documentElement: { dataset: {} },
    createElement: () => ({ dataset: {} }), head: { appendChild: (s: unknown) => scripts.push(s) } };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
  Object.defineProperty(globalThis, "document", { value: fakeDocument, configurable: true });
  const commands = () => queue.filter(q => Object.prototype.toString.call(q) === "[object Arguments]").map(q => Array.from(q as IArguments));
  const purchases = () => commands().filter(c => c[0] === "event" && c[1] === "purchase");
  const id = "G-VDMP7TKMNY", gtm = "GTM-5VRFG7ZT";
  try {
    applyGoogleConsent(false, id, gtm);
    assert.equal(trackConfirmedGooglePurchase(receipt), false);
    assert.equal(scripts.length, 0); assert.equal(storage.has(PURCHASE_STORAGE_KEY), false);
    storage.set("imperio_cookie_consent", JSON.stringify({ version: LEGAL_DOCUMENT_VERSIONS.cookies, analytics: true,
      preferences: false, marketing: false, updatedAt: new Date().toISOString() }));
    applyGoogleConsent(true, id, gtm);
    assert.equal(scripts.length, 0, "return-page visit alone must not load Google");
    assert.equal(trackConfirmedGooglePurchase(null), false);
    location.hash = "secret.token";
    assert.equal(trackConfirmedGooglePurchase(receipt), false);
    location.hash = "";
    assert.equal(trackConfirmedGooglePurchase(receipt), true);
    assert.equal(scripts.length, 1); assert.equal(purchases().length, 0);
    assert.equal(storage.has(PURCHASE_STORAGE_KEY), false, "do not lose the event when tags fail to load");
    assert.equal(scripts[0].referrerPolicy, "no-referrer");
    const consent = storage.get("imperio_cookie_consent")!;
    storage.delete("imperio_cookie_consent"); applyGoogleConsent(false, id, gtm);
    scripts[0].onload();
    assert.equal(purchases().length, 0, "withdrawing while the SDK loads must cancel the queued purchase");
    storage.set("imperio_cookie_consent", consent);
    assert.equal(trackConfirmedGooglePurchase(receipt), true);
    scripts[0].onload();
    assert.equal(purchases().length, 1);
    const p = purchases()[0][2] as Record<string, unknown>;
    assert.equal(p.page_location, "https://imperioes.com/tienda");
    assert.equal(p.page_referrer, ""); assert.equal(p.value, 22.31);
    assert.doesNotMatch(JSON.stringify(queue), /secret|Private customer|compra\/completada|reservas\/gestionar/);
    assert.equal(commands().filter(c => c[1] === "page_view").length, 0);
    assert.equal(commands().filter(c => c[0] === "config").length, 0);
    assert.equal(trackConfirmedGooglePurchase(receipt), false);
    assert.equal(purchases().length, 1);
    const other = { ...receipt, transaction_id: `ie_${"b".repeat(64)}` };
    storage.set(PURCHASE_STORAGE_KEY, JSON.stringify([{ id: other.transaction_id, at: Date.now() }]));
    assert.equal(trackConfirmedGooglePurchase(other), false, "a previous page/tab already queued this transaction");
    const ledger = Array.from({length:40}, (_, i) => ({id:`ie_${i.toString(16).padStart(64,"0")}`,at:Date.now()}));
    storage.set(PURCHASE_STORAGE_KEY, JSON.stringify(ledger));
    assert.equal(trackConfirmedGooglePurchase({...receipt,transaction_id:ledger[0].id}), false, "the oldest of 40 retained transactions is still deduplicated");
    location.pathname = "/cuenta";
    assert.equal(trackConfirmedGooglePurchase({ ...receipt, transaction_id: `ie_${"c".repeat(64)}` }), false);
    location.pathname = "/gracias";
    assert.equal(trackConfirmedGooglePurchase({ ...receipt, transaction_id: `ie_${"e".repeat(64)}` }), false, "shirt receipts cannot use the subscription context");
    const subscription = { transaction_id: `ie_${"f".repeat(64)}`, currency: "EUR", value: 31.4, tax: 6.59, shipping: 0,
      items: [{ item_id: "IE-MAESTRE-ANNUAL", item_variant: "maestre-campo-annual", item_category: "Suscripciones", quantity: 1, price: 31.4 }] };
    assert.equal(trackConfirmedGooglePurchase(subscription), true);
    assert.equal(purchases().length, 2);
    assert.equal((purchases()[1][2] as Record<string, unknown>).page_location, "https://imperioes.com/suscribirse");
    assert.doesNotMatch(JSON.stringify(queue), /session_id|\/gracias|cs_live|Private customer/);
    assert.equal(trackConfirmedGooglePurchase(subscription), false);
    location.pathname = "/compra/completada";
    assert.equal(trackConfirmedGooglePurchase({ ...subscription, transaction_id: `ie_${"e".repeat(64)}` }), false);
    storage.delete("imperio_cookie_consent"); applyGoogleConsent(false, id, gtm);
    assert.equal(trackConfirmedGooglePurchase({ ...receipt, transaction_id: `ie_${"d".repeat(64)}` }), false);
    assert.equal(purchases().length, 2); assert.equal(scripts.length, 1);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});

test("withdrawal clears the purchase ledger and the manager only measures the verified payment return", () => {
  const consent = readFileSync("src/components/CookieConsent.astro", "utf8");
  assert.match(consent, /localStorage\.removeItem\(PURCHASE_STORAGE_KEY\)/);
  assert.match(consent, /else \{\s+deleteAnalyticsCookies\(\);\s+setGoogleConsent\(false\)/);
  const manager = readFileSync("src/components/commerce/ReservationManager.tsx", "utf8");
  assert.match(manager, /!paymentReturn \|\| r\?\.status !== "CONVERTED_TO_ORDER" \|\| !analyticsPurchase/);
  assert.match(manager, /setAnalyticsPurchase\(data\.analyticsPurchase \?\? null\)/);
  const confirmation = readFileSync("src/components/commerce/SubscriptionConfirmation.tsx", "utf8");
  assert.match(confirmation, /replaceState\(null, "", window.location.pathname\)/);
  assert.match(confirmation, /imperio:cookie-consent/);
  assert.match(confirmation, /readSavedConsent\(LEGAL_DOCUMENT_VERSIONS.cookies\)\?\.analytics/);
  assert.doesNotMatch(confirmation, /localStorage.setItem|sessionStorage.setItem/);
});

test("privacy copy discloses the verified purchase exception without internal legal TODOs", () => {
  const privacy = readFileSync("src/pages/legal/privacidad.astro", "utf8");
  const cookies = readFileSync("src/pages/legal/cookies.astro", "utf8");
  assert.match(privacy, /primer pago de la suscripcion/);
  assert.match(privacy, /Transferencias internacionales/);
  assert.doesNotMatch(privacy, /REQUIERE VERIFICACION|debe definirse|antes de publicar esta revision/);
  assert.match(cookies, /retorno limpio de una compra confirmada por el servidor/);
  assert.match(cookies, /solo con consentimiento vigente/);
});
