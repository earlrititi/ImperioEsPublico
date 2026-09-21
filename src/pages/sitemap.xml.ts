import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { ARTICLES_ITEMS } from "../config/home";
import { AUTHORS, REFERENCE_PAGES, getArticleEditorial } from "../config/editorial";
import { INDEXABLE_STATIC_ROUTES, canonicalUrl, escapeXml } from "../lib/seo";

export const GET: APIRoute = async () => {
  const entries: { path: string; modified?: string }[] = [
    ...INDEXABLE_STATIC_ROUTES.map(path => ({ path })),
    ...ARTICLES_ITEMS.map(article => ({
      path: `/papeles-y-tratados/${article.slug}`,
      modified: getArticleEditorial(article.slug).modifiedAt ?? article.publishedAt,
    })),
    ...Object.entries(AUTHORS).filter(([, author]) => author.published).map(([id]) => ({ path: `/autores/${id}` })),
    ...Object.entries(REFERENCE_PAGES).filter(([, page]) => page.published).map(([id, page]) => ({ path: `/${id}`, modified: page.modifiedAt })),
  ];
  for (const [collection, prefix] of [["articles", "biblioteca"], ["lanzamientos", "tienda"], ["rutas", "rutas"]] as const) {
    const items = (await getCollection(collection)).filter(entry => entry.data.indexable);
    if (items.length && prefix !== "tienda") entries.push({ path: `/${prefix}` });
    entries.push(...items.map(entry => ({ path: `/${prefix}/${entry.id}` })));
    if (collection === "articles") {
      for (const category of ["efemeride", "ensayo", "presente"]) {
        if (items.some(entry => "category" in entry.data && entry.data.category === category)) {
          entries.push({ path: `/${category === "efemeride" ? "efemerides" : category === "ensayo" ? "ensayos" : "presente"}` });
        }
      }
    }
  }
  const urls = new Map(entries.map(entry => [canonicalUrl(entry.path), entry.modified]));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map(([url, modified]) => `  <url><loc>${escapeXml(url)}</loc>${modified ? `<lastmod>${escapeXml(modified)}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
    },
  });
};
