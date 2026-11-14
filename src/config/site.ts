import { BRAND } from "./brand";

export const SITE = {
  name: BRAND.name,
  alternateName: BRAND.shortName,
  defaultTitle: "Imperio Español | Historia, cultura, memoria y patrimonio",
  url: BRAND.url,
  contactEmail: "contacto@imperioes.com",
  defaultDescription:
    "Divulgación histórica sobre la Monarquía Hispánica, el Imperio español y el Siglo de Oro: artículos, cultura y memoria histórica.",
  defaultOgImage: BRAND.metadata.socialImage,
  sameAs: [
    "https://www.instagram.com/imperio_e/",
    "https://www.facebook.com/ElMayorImperioDeTodos/",
    "https://x.com/Imperio_e",
  ],
};
