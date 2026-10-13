import { readSavedConsent } from "./cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";

const hosts = ["imperioes.com", "www.imperioes.com"];
const publicPaths = new Set([
  "/", "/instagram", "/reservas", "/tienda", "/precios", "/comunidad",
  "/manifiesto", "/contacto", "/sobre-nosotros", "/archivo", "/ensayos",
  "/presente", "/efemerides", "/papeles-y-tratados", "/biblioteca", "/libreria",
  "/rutas", "/foro", "/legal", "/privacidad", "/cookies",
]);

export function canTrackGooglePage(href: string, referrer = ""): boolean {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password) return false;
    if (!publicPaths.has(path) && !/^\/(articulos|autores|biblioteca|papeles-y-tratados|rutas|tienda|legal)\/[a-z0-9-]+$/.test(path)) return false;
    if (url.hash && !/^#[a-z][a-z0-9-]{0,60}$/.test(url.hash)) return false;
    for (const [key, value] of url.searchParams) {
      if (/^utm_(source|medium|campaign|content|term)$/.test(key) && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) continue;
      if (key === "size" && ["S", "M", "L", "XL", "XXL"].includes(value)) continue;
      if (key === "fbclid" && /^[a-zA-Z0-9_-]{1,500}$/.test(value)) continue;
      return false;
    }
    if (referrer) {
      const previous = new URL(referrer);
      if (previous.search || previous.hash || previous.username || previous.password) return false;
      if (hosts.includes(previous.hostname) && !canTrackGooglePage(referrer)) return false;
    }
    return true;
  } catch { return false; }
}

type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
let measurementId = "";
let installed = false;
let viewed = false;
let initialized = false;

function allowed() {
  return typeof window !== "undefined" && Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) &&
    canTrackGooglePage(window.location.href, document.referrer);
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
  }
  if (!active) {
    if (installed) target.gtag!("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    document.documentElement.dataset.googleAnalyticsState = "blocked";
    return;
  }
  target.gtag!("consent", "update", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  if (installed) return;
  installed = true;
  const location = `${window.location.origin}${window.location.pathname}`;
  const campaign: Record<string, string> = {};
  const parameters = new URL(window.location.href).searchParams;
  for (const [source, field] of Object.entries({ utm_source: "campaign_source", utm_medium: "campaign_medium", utm_campaign: "campaign_name", utm_content: "campaign_content", utm_term: "campaign_term" })) {
    const value = parameters.get(source);
    if (value && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) campaign[field] = value;
  }
  const options = {
    ...campaign,
    send_page_view: false, page_location: location, page_referrer: "", page_title: "Imperio E",
    allow_google_signals: false, allow_ad_personalization_signals: false,
    cookie_expires: 60 * 60 * 24 * 365, cookie_update: false,
  };
  target.gtag!("js", new Date());
  target.gtag!("config", id, options);
  if (!viewed) {
    viewed = true;
    target.gtag!("event", "page_view", { ...options, send_to: id });
  }
  const script = document.createElement("script");
  script.async = true;
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
    send_to: measurementId, page_location: `${window.location.origin}${window.location.pathname}`,
    page_referrer: "", page_title: "Imperio E",
  };
  if (["S", "M", "L", "XL", "XXL"].includes(String(details.size))) payload.size = String(details.size);
  (window as AnalyticsWindow).gtag?.("event", event, payload);
}
