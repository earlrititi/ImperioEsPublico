import { ARTICLES_ITEMS } from "../config/home";
import { getArticleTier } from "../config/article-access";
import { getArticleEditorial, getAuthors, getEntities } from "../config/editorial";
import { SITE } from "../config/site";
import { canonicalUrl } from "./seo";

export function relatedArticles(slug: string) {
  const article = ARTICLES_ITEMS.find(item => item.slug === slug);
  if (!article) return [];
  const explicit = article.relatedSlugs ?? [];
  const entities = getArticleEditorial(slug).entityIds;
  const candidates = ARTICLES_ITEMS.filter(item => item.slug !== slug);
  const score = (item: typeof candidates[number]) =>
    (explicit.includes(item.slug) ? 100 - explicit.indexOf(item.slug) : 0) +
    getArticleEditorial(item.slug).entityIds.filter(id => entities.includes(id)).length * 10 +
    (item.category === article.category ? 1 : 0);
  return candidates.filter(item => score(item) > 0).sort((a, b) => score(b) - score(a)).slice(0, 3);
}

export function articleSchema(article: typeof ARTICLES_ITEMS[number]) {
  const editorial = getArticleEditorial(article.slug);
  const authors = getAuthors(editorial.authorIds);
  const entities = getEntities(editorial.entityIds);
  return {
    "@type": "Article",
    "@id": `${canonicalUrl(`/papeles-y-tratados/${article.slug}`)}#article`,
    headline: article.title, description: article.description,
    image: new URL(article.imageSrc, SITE.url).href,
    inLanguage: "es", articleSection: article.category,
    isAccessibleForFree: getArticleTier(article.slug) === "piquero",
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(editorial.modifiedAt ? { dateModified: editorial.modifiedAt } : {}),
    ...(authors.length ? { author: authors.map(author => ({
      "@type": author.type, name: author.name, url: canonicalUrl(`/autores/${author.id}`),
    })) } : {}),
    ...(entities.length ? { about: entities.map(entity => ({
      "@type": "Thing", name: entity.title, url: canonicalUrl(`/${entity.id}`),
    })) } : {}),
    mainEntityOfPage: canonicalUrl(`/papeles-y-tratados/${article.slug}`),
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

export function articleSearchText(article: typeof ARTICLES_ITEMS[number]) {
  return [article.title, article.category, article.description,
    ...getEntities(getArticleEditorial(article.slug).entityIds).map(entity => entity.title),
  ].join(" ").toLowerCase();
}
