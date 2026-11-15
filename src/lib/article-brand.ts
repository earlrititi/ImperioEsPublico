import { BRAND } from "../config/brand";

// Presentation aliases only: do not rewrite editorial photos or stored bodies.
const CORPORATE_IMAGE_PATHS = new Set<string>([
  "/images/logo-redv2.png",
  "/images/logo-redv2.webp",
  "/images/logo-redv2-96.webp",
  "/images/logo-redv2-320.webp",
  "/images/logo-redv2-480.webp",
  "/images/imperio-espanol-wordmark.svg",
  BRAND.logos.principal.svg,
  BRAND.logos.principal.png,
]);

export function normalizeArticleBrand<T extends { imageSrc: string }>(article: T) {
  if (!CORPORATE_IMAGE_PATHS.has(article.imageSrc)) return article;
  return {
    ...article,
    imageSrc: BRAND.logos.principal.svg,
    imageWidth: BRAND.logos.principal.width,
    imageHeight: BRAND.logos.principal.height,
    imageAvifSrcSet: undefined,
    imageWebpSrcSet: undefined,
    brandVariant: "principal" as const,
  };
}
