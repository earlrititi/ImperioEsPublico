import { getArticleTier } from "../config/article-access";
import { ARTICLES_ITEMS } from "../config/home";

if (!import.meta.env.SSR) {
  throw new Error("Article bodies can only be loaded on the server.");
}

const sources = import.meta.glob<string>("../data/article-texts/*.txt", {
  query: "?raw",
  import: "default",
});

export function getPublishedArticleTiers() {
  return ARTICLES_ITEMS.filter(
    (article) => sources[`../data/article-texts/${article.sourceFile}`]
  ).map((article) => getArticleTier(article.slug));
}

export async function loadArticleSource(sourceFile: string) {
  const load = sources[`../data/article-texts/${sourceFile}`];
  if (!load) throw new Error("Article source not found.");
  return load();
}
