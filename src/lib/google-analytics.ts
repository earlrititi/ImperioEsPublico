import { readSavedConsent } from "./cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { INDEXABLE_STATIC_ROUTES } from "./seo";
import { ecommercePayload, googlePurchasePayload, type CommerceEvent, type GooglePurchase } from "./ecommerce";
import type { CartItem } from "./cart";

const hosts = ["imperioes.com", "www.imperioes.com"];
const publicPaths = new Set([
  ...INDEXABLE_STATIC_ROUTES,
  "/", "/instagram", "/reservas", "/carrito", "/tienda", "/precios", "/comunidad",
  "/manifiesto", "/contacto", "/sobre-nosotros", "/archivo", "/ensayos",
  "/presente", "/efemerides", "/papeles-y-tratados", "/biblioteca", "/libreria",
  "/rutas", "/foro", "/legal", "/privacidad", "/cookies",
  "/recursos/7-historias-del-siglo-de-oro",
]);

export function canTrackGooglePage(href: string): boolean {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password) return false;
    if (!publicPaths.has(path) && !/^\/(articulos|autores|biblioteca|papeles-y-tratados|rutas|tienda|legal)(?:\/[a-z0-9-]+)+$/.test(path)) return false;
    if (url.hash && !/^#[a-z][a-z0-9-]{0,60}$/.test(url.hash)) return false;
    for (const [key, value] of url.searchParams) {
      if (/^utm_(source|medium|campaign|content|term)$/.test(key) && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) continue;
      if (key === "size" && ["S", "M", "L", "XL", "XXL"].includes(value)) continue;
      if (key === "cart" && value === "1" && path === "/reservas") continue;
      if (key === "fbclid" && /^[a-zA-Z0-9_-]{1,500}$/.test(value)) continue;
      return false;
    }
    return true;
  } catch { return false; }
}

export function googlePageFields(href: string, referrer = "", title = "Imperio E") {
  if (!canTrackGooglePage(href)) return null;
  const current = new URL(href);
  let previousLocation = "";
  try {
    const previous = new URL(referrer);
    if (previous.protocol === "https:" && !previous.username && !previous.password) {
      if (hosts.includes(previous.hostname)) {
        const publicLocation = `${previous.origin}${previous.pathname}`;
        if (canTrackGooglePage(publicLocation)) previousLocation = publicLocation;
      } else if (previous.hostname.includes(".") && !/^[\d.]+$/.test(previous.hostname) && !previous.hostname.endsWith(".local")) {
        previousLocation = previous.origin;
      }
    }
  } catch { /* An absent or private referrer must not block a public page. */ }
  return {
    page_location: `${current.origin}${current.pathname}`,
    page_referrer: previousLocation,
    page_title: /[^\s]+@[^\s]+\.[^\s]+/.test(title) ? "Imperio E" : title.trim().slice(0, 200) || "Imperio E",
  };
}

type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
let measurementId = "";
let installed = false;
let ready = false;
let viewed = false;
let initialized = false;
let authEventTracked = false;
let configuredGtmId = "";
let purchaseContext = false;
let pendingPurchase: GooglePurchase | null = null;
const queuedPurchases = new Set<string>();
export const PURCHASE_STORAGE_KEY = "imperio_ga4_purchases";
export const AUTH_EVENT_STORAGE_KEY = "imperio_ga4_auth_events";
const purchaseRetention = 30 * 24 * 60 * 60 * 1000;

export function googlePurchasePageFields(href: string) {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.port || url.username || url.password ||
      !["/compra/completada", "/gracias"].includes(url.pathname) || url.search || url.hash) return null;
    // The private return URL/referrer/title is never supplied to Google.
    return url.pathname === "/gracias"
      ? { page_location: `${url.origin}/suscribirse`, page_referrer: "", page_title: "Suscripciones | Imperio E" }
      : { page_location: `${url.origin}/tienda`, page_referrer: "", page_title: "Camiseta Imperial | Imperio E" };
  } catch { return null; }
}

function allowed() {
  return typeof window !== "undefined" && Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) &&
    canTrackGooglePage(window.location.href);
}

function pageFields() {
  return googlePageFields(window.location.href, document.referrer, document.title) ?? googlePurchasePageFields(window.location.href)!;
}

function loaderAllowed() {
  return typeof window !== "undefined" && Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) &&
    (canTrackGooglePage(window.location.href) || (purchaseContext && Boolean(googlePurchasePageFields(window.location.href))));
}

function purchaseLedger(): { id: string; at: number }[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PURCHASE_STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter(e => /^ie_[a-f0-9]{64}$/.test(e?.id) &&
      Number.isSafeInteger(e.at) && e.at <= Date.now() && Date.now() - e.at < purchaseRetention).slice(-40) : [];
  } catch { return []; }
}

function flushPurchase() {
  if (!ready || !installed || !pendingPurchase || !loaderAllowed() || !googlePurchasePageFields(window.location.href)) return;
  if ((window.location.pathname === "/gracias") !== (pendingPurchase.items[0].item_category === "Suscripciones")) return;
  const receipt = pendingPurchase;
  pendingPurchase = null;
  const ledger = purchaseLedger();
  if (queuedPurchases.has(receipt.transaction_id) || ledger.some(e => e.id === receipt.transaction_id)) return;
  queuedPurchases.add(receipt.transaction_id);
  (window as AnalyticsWindow).gtag?.("event", "purchase", { ...pageFields(), ...receipt, send_to: measurementId });
  try {
    window.localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify([...ledger, { id: receipt.transaction_id, at: Date.now() }].slice(-40)));
  } catch { /* GA4 can also deduplicate the stable transaction_id for the same web user. */ }
}

export function trackConfirmedGooglePurchase(input: unknown): boolean {
  const receipt = googlePurchasePayload(input);
  if (!receipt || typeof window === "undefined" || !googlePurchasePageFields(window.location.href) ||
    !readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) return false;
  if ((window.location.pathname === "/gracias") !== (receipt.items[0].item_category === "Suscripciones")) return false;
  if (queuedPurchases.has(receipt.transaction_id) || purchaseLedger().some(e => e.id === receipt.transaction_id)) return false;
  pendingPurchase = receipt;
  purchaseContext = true;
  applyGoogleConsent(true, measurementId, configuredGtmId);
  return true;
}

function recordPageView() {
  if (!installed || viewed || !allowed()) return;
  viewed = true;
  (window as AnalyticsWindow).gtag?.("event", "page_view", { ...pageFields(), send_to: measurementId });
  trackAutomationActivity("site");
}

export function trackAutomationActivity(kind: "site" | "viewed_product" | "cart" | "cart_cleared") {
  if (!allowed()) return;
  // Identity, email opt-in and activation are checked independently on our server.
  void fetch("/api/marketing/activity", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }), keepalive: true }).catch(() => {});
}

export function applyGoogleConsent(granted: boolean, id: string, gtmId = "") {
  if (typeof window === "undefined" || !/^G-[A-Z0-9]+$/.test(id)) return;
  measurementId = id;
  configuredGtmId = gtmId;
  const target = window as AnalyticsWindow;
  const active = granted && loaderAllowed();
  Reflect.set(target, `ga-disable-${id}`, !active);
  // Basic consent mode: no Google SDK or network requests before opt-in.
  if (!initialized) {
    target.dataLayer ??= [];
    // gtag commands require Arguments objects, not ordinary arrays.
    target.gtag ??= function () { target.dataLayer!.push(arguments); };
    target.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    initialized = true;
    window.addEventListener("pageshow", event => {
      if (!event.persisted) return;
      viewed = false;
      applyGoogleConsent(Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics), id, gtmId);
    });
  }
  if (!active) {
    pendingPurchase = null;
    purchaseContext = false;
    if (installed) target.gtag!("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    document.documentElement.dataset.googleAnalyticsState = "blocked";
    return;
  }
  target.gtag!("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  if (installed) { if (ready) document.documentElement.dataset.googleAnalyticsState = "active"; recordPageView(); flushPurchase(); return; }
  installed = true;
  const campaign: Record<string, string> = {};
  const parameters = new URL(window.location.href).searchParams;
  for (const [source, field] of Object.entries({ utm_source: "campaign_source", utm_medium: "campaign_medium", utm_campaign: "campaign_name", utm_content: "campaign_content", utm_term: "campaign_term" })) {
    const value = parameters.get(source);
    if (value && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) campaign[field] = value;
  }
  const options = {
    ...campaign,
    ...pageFields(), send_page_view: false,
    allow_google_signals: false, allow_ad_personalization_signals: false,
    cookie_domain: "imperioes.com", cookie_expires: 60 * 60 * 24 * 365, cookie_update: false,
  };
  const useGtm = /^GTM-[A-Z0-9]+$/.test(gtmId);
  if (useGtm) {
    // The container owns the single Google tag; page views remain explicit.
    target.gtag!("set", options);
    target.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
  } else {
    target.gtag!("js", new Date());
    target.gtag!("config", id, options);
  }
  recordPageView();
  const script = document.createElement("script");
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.src = useGtm ? `https://www.googletagmanager.com/gtm.js?id=${gtmId}` : `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.dataset.googleAnalytics = id;
  script.onload = () => {
    ready = true;
    if (!loaderAllowed()) { applyGoogleConsent(false, id, gtmId); return; }
    document.documentElement.dataset.googleAnalyticsState = "active";
    flushPurchase();
  };
  script.onerror = () => { document.documentElement.dataset.googleAnalyticsState = "unavailable"; };
  document.documentElement.dataset.googleAnalyticsState = "loading";
  document.head.appendChild(script);
}

const publicEvents = new Set(["instagram_reserve_click", "instagram_subscription_click", "instagram_landing_view", "instagram_product_view", "meta_product_click", "reservation_started", "reservation_completed"]);

export function trackConfirmedGoogleAuthEvent(event: unknown, method: unknown, consentAt: unknown, id: unknown, expiresAt: number): boolean {
  if (authEventTracked || !installed || !allowed() || typeof event !== "string" || !["login", "sign_up"].includes(event) ||
    typeof method !== "string" || !["password", "magic_link"].includes(method) || typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id) ||
    !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 5 * 60 * 1000 ||
    readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.updatedAt !== consentAt) return false;
  authEventTracked = true;
  try {
    const saved = JSON.parse(window.localStorage.getItem(AUTH_EVENT_STORAGE_KEY) ?? "[]");
    const ledger = Array.isArray(saved) ? saved.filter(entry => /^[a-f0-9]{64}$/.test(entry?.id) &&
      Number.isSafeInteger(entry.expiresAt) && entry.expiresAt > Date.now() && entry.expiresAt <= Date.now() + 5 * 60 * 1000).slice(-10) : [];
    if (ledger.some(entry => entry.id === id)) return false;
    window.localStorage.setItem(AUTH_EVENT_STORAGE_KEY, JSON.stringify([...ledger, { id, expiresAt }].slice(-10)));
  } catch { /* In-memory deduplication still prevents repeats within this page. */ }
  (window as AnalyticsWindow).gtag?.("event", event, { ...pageFields(), method, send_to: measurementId });
  return true;
}

export function trackGoogleEvent(event: string, details: Record<string, string | number> = {}) {
  if (!installed || !allowed() || !publicEvents.has(event)) return;
  const payload: Record<string, string> = {
    ...pageFields(), send_to: measurementId,
  };
  if (["S", "M", "L", "XL", "XXL"].includes(String(details.size))) payload.size = String(details.size);
  (window as AnalyticsWindow).gtag?.("event", event, payload);
}

export function trackGoogleCommerce(event: CommerceEvent, items: CartItem[]): boolean {
  const payload = ecommercePayload(event, items);
  if (!payload || !installed || !allowed()) return false;
  (window as AnalyticsWindow).gtag?.("event", event, { ...pageFields(), ...payload, send_to: measurementId });
  if (event === "view_item") trackAutomationActivity("viewed_product");
  if (event === "add_to_cart") trackAutomationActivity("cart");
  return true;
}
