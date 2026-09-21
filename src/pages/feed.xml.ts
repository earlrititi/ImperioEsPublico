import type { APIRoute } from "astro";
import { ARTICLES_ITEMS } from "../config/home";
import { getArticleTier } from "../config/article-access";
import { SITE } from "../config/site";
import { canonicalUrl, escapeXml } from "../lib/seo";

// Metadata only: this endpoint never imports the server-only article source loader.
export const GET: APIRoute = () => {
  const articles = ARTICLES_ITEMS.filter(article => getArticleTier(article.slug) === "piquero")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${escapeXml(SITE.name)}</title><link>${SITE.url}</link>
<description>${escapeXml(SITE.defaultDescription)}</description><language>es</language>
<atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml" />
${articles.map(article => {
  const url = escapeXml(canonicalUrl(`/papeles-y-tratados/${article.slug}`));
  return `<item><title>${escapeXml(article.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeXml(article.description)}</description>${article.publishedAt ? `<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : ""}</item>`;
}).join("\n")}
</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=UTF-8" } });
};
