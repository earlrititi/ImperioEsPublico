import { SITE } from "../config/site";

export function canonicalUrl(path: string) {
  const url = new URL(path, SITE.url);
  if (url.origin !== SITE.url) throw new Error("Canonical must use the site origin");
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, character => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

export function formatEditorialDate(date: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "UTC" }).format(new Date(date));
}

// Only pages reviewed as useful public destinations belong in this allowlist.
export const INDEXABLE_STATIC_ROUTES = [
  "/", "/manifiesto", "/suscribirse", "/papeles-y-tratados", "/tienda",
  "/sobre-nosotros", "/contacto", "/legal/aviso-legal", "/legal/privacidad",
  "/legal/cookies", "/legal/terminos", "/legal/devoluciones", "/legal/desistimiento",
  "/legal/accesibilidad", "/legal/envios", "/legal/reservas",
];

export function hasSearchParameters(url: URL) {
  return ["q", "search", "category", "tier"].some(key => url.searchParams.has(key));
}
