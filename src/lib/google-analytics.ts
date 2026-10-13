import { readSavedConsent } from "./cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { INDEXABLE_STATIC_ROUTES } from "./seo";

const hosts = ["imperioes.com", "www.imperioes.com"];
const publicPaths = new Set([
  ...INDEXABLE_STATIC_ROUTES,
  "/", "/instagram", "/reservas", "/tienda", "/precios", "/comunidad",
  "/manifiesto", "/contacto", "/sobre-nosotros", "/archivo", "/ensayos",
  "/presente", "/efemerides", "/papeles-y-tratados", "/biblioteca", "/libreria",
  "/rutas", "/foro", "/legal", "/privacidad", "/cookies",
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
let viewed = false;
let initialized = false;

function allowed() {
  return typeof window !== "undefined" && Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) &&
    canTrackGooglePage(window.location.href);
}

function pageFields() {
  return googlePageFields(window.location.href, document.referrer, document.title)!;
}

function recordPageView() {
  if (!installed || viewed || !allowed()) return;
  viewed = true;
  (window as AnalyticsWindow).gtag?.("event", "page_view", { ...pageFields(), send_to: measurementId });
}

export function applyGoogleConsent(granted: boolean, id: string) {
  if (typeof window === "undefined" || !/^G-[A-Z0-9]+$/.test(id)) return;
  measurementId = id;
  const target = window as AnalyticsWindow;
  const active = granted && allowed();
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
      applyGoogleConsent(Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics), id);
    });
  }
  if (!active) {
    if (installed) target.gtag!("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    document.documentElement.dataset.googleAnalyticsState = "blocked";
    return;
  }
  target.gtag!("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  if (installed) { recordPageView(); return; }
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
  target.gtag!("js", new Date());
  target.gtag!("config", id, options);
  recordPageView();
  const script = document.createElement("script");
  script.async = true;
  script.referrerPolicy = "no-referrer";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.dataset.googleAnalytics = id;
  script.onload = () => {
    if (!allowed()) { applyGoogleConsent(false, id); return; }
    document.documentElement.dataset.googleAnalyticsState = "active";
  };
  script.onerror = () => { document.documentElement.dataset.googleAnalyticsState = "unavailable"; };
  document.documentElement.dataset.googleAnalyticsState = "loading";
  document.head.appendChild(script);
}

const publicEvents = new Set(["instagram_reserve_click", "instagram_subscription_click", "instagram_landing_view", "instagram_product_view", "meta_product_click", "reservation_started", "reservation_completed"]);

export function trackGoogleEvent(event: string, details: Record<string, string | number> = {}) {
  if (!installed || !allowed() || !publicEvents.has(event)) return;
  const payload: Record<string, string> = {
    ...pageFields(), send_to: measurementId,
  };
  if (["S", "M", "L", "XL", "XXL"].includes(String(details.size))) payload.size = String(details.size);
  (window as AnalyticsWindow).gtag?.("event", event, payload);
}
