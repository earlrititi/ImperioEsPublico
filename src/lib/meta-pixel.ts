import { readSavedConsent } from "./cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";

export const META_PIXEL_ID = "888945184182715";
// Preserve the existing catalog item's identity until its variants are migrated.
export const META_SHIRT_ID = "o0y3czmtpg";

export function canTrackMetaPage(href: string, referrer = ""): boolean {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" || !["imperioes.com", "www.imperioes.com"].includes(url.hostname)) return false;
    if (!["/instagram", "/instagram/", "/reservas", "/reservas/"].includes(url.pathname) || url.hash) return false;
    for (const [key, value] of url.searchParams) {
      if (key === "size" && ["S", "M", "L", "XL", "XXL"].includes(value)) continue;
      if (/^utm_(source|medium|campaign|content|term)$/.test(key) && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) continue;
      if (key === "fbclid" && /^[a-zA-Z0-9_-]{1,500}$/.test(value)) continue;
      return false;
    }
    // The SDK also reads document.referrer. Never load it after private links.
    if (referrer) {
      const previous = new URL(referrer);
      if (previous.search || previous.hash || previous.username || previous.password) return false;
      if (["imperioes.com", "www.imperioes.com"].includes(previous.hostname) &&
          !["/", "/instagram", "/instagram/", "/tienda", "/tienda/", "/reservas", "/reservas/", "/checkout/camiseta-imperial"].includes(previous.pathname)) return false;
    }
    return !url.username && !url.password;
  } catch { return false; }
}

export function metaCommerceEvent(event: string) {
  if (event === "reservation_started") return { method: "trackSingle", name: "InitiateCheckout" };
  if (event === "reservation_completed") return { method: "trackSingleCustom", name: "ReservationCompleted" };
  return null;
}

type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Pixel;
  loaded?: boolean;
  version?: string;
};
type PixelWindow = Window & { fbq?: Pixel; _fbq?: Pixel };
let installed = false;
let ready = false;
let viewed = false;

function allowed() {
  return typeof window !== "undefined" &&
    Boolean(readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.marketing) &&
    canTrackMetaPage(window.location.href, document.referrer);
}

function clearMetaCookies() {
  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of ["", window.location.hostname, "imperioes.com", ".imperioes.com"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

function recordPublicView() {
  if (!ready || !allowed()) return;
  const pixel = (window as PixelWindow).fbq;
  pixel?.("consent", "grant");
  if (viewed) return;
  viewed = true;
  pixel?.("trackSingle", META_PIXEL_ID, "PageView");
  if (window.location.pathname.replace(/\/$/, "") === "/instagram") {
    pixel?.("trackSingle", META_PIXEL_ID, "ViewContent", { content_ids: [META_SHIRT_ID], content_type: "product" });
  }
  document.documentElement.dataset.metaPixelState = "active";
}

export function applyMetaConsent(granted: boolean) {
  if (typeof window === "undefined") return;
  const target = window as PixelWindow;
  if (!granted || !allowed()) {
    target.fbq?.("consent", "revoke");
    clearMetaCookies();
    document.documentElement.dataset.metaPixelState = "blocked";
    return;
  }
  if (installed) { recordPublicView(); return; }
  // Do not mix this installation with an unknown tag manager's pixel instance.
  if (target.fbq) return;
  installed = true;
  const pixel: Pixel = Object.assign((...args: unknown[]) => {
    if (pixel.callMethod) pixel.callMethod(...args);
    else pixel.queue.push(args);
  }, { queue: [] as unknown[][], loaded: true, version: "2.0" });
  pixel.push = pixel;
  target.fbq = target._fbq = pixel;
  pixel("consent", "revoke");
  pixel("set", "autoConfig", false, META_PIXEL_ID);
  pixel("init", META_PIXEL_ID);
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.dataset.metaPixel = META_PIXEL_ID;
  script.onload = () => { ready = true; recordPublicView(); };
  script.onerror = () => { document.documentElement.dataset.metaPixelState = "unavailable"; };
  document.documentElement.dataset.metaPixelState = "loading";
  document.head.appendChild(script);
}

export function trackMetaCommerceEvent(event: string) {
  const descriptor = metaCommerceEvent(event);
  if (!descriptor || !ready || !allowed()) return;
  (window as PixelWindow).fbq?.(descriptor.method, META_PIXEL_ID, descriptor.name, {
    content_ids: [META_SHIRT_ID], content_type: "product", reservation_type: "free",
  });
}
