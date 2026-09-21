// Stable identifiers: sorting the catalogue must never change access rights.
export const FREE_ARTICLE_SLUGS = [
  "bienvenidos-a-la-web-del-imperio-espanol",
  "el-imperio-donde-nunca-se-pone-el-sol",
  "12-de-octubre-dia-de-la-hispanidad",
  "rey-de-espana-legitimo-emperador-de-roma",
  "carlos-v-y-la-justicia-de-la-conquista",
  "tras-lepanto-constantinopla",
] as const;

const freeArticles = new Set<string>(FREE_ARTICLE_SLUGS);

export function getArticleTier(slug: string): "piquero" | "arcabucero" {
  return freeArticles.has(slug) ? "piquero" : "arcabucero";
}
