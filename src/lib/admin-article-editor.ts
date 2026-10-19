import type { ArticleDraft } from "./admin-article-content";

export function articleSlug(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160).replace(/-$/, "");
}

export function articlePublicationIssues(draft: ArticleDraft) {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push("Titulo");
  if (!draft.publishedAt) issues.push("Fecha de publicacion");
  if (!draft.body.replace(/<[^>]*>/g, "").replace(/&(?:nbsp|#160);/g, " ").trim()) issues.push("Contenido");
  if (!draft.seoTitle.trim()) issues.push("Titulo SEO");
  if (!draft.description.trim()) issues.push("Descripcion SEO");
  if (draft.imageSrc && !draft.imageAlt.trim()) issues.push("Texto alternativo de la imagen principal");
  return issues;
}
