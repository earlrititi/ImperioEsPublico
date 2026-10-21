import { SITE } from "./site";

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-10-04",
  privacy: "2026-10-16",
  cookies: "2026-10-16",
  returns: "2026-09-10",
} as const;

export const LEGAL_BUSINESS = {
  ownerName: "Adrian Lopez Oliva",
  tradeName: "Imperio Español",
  taxId: "44067163Z",
  registeredAddress: "C/ Sobre los Ángeles, nº 9, 3º D, 11160 Barbate (Cádiz), España",
  registryDetails: "No procede: titular persona física no inscrita en el Registro Mercantil",
  legalEmail: SITE.contactEmail,
  returnsAddress: "Adrian Lopez Oliva — Imperio Español, C/ Sobre los Ángeles, nº 9, 3º D, 11160 Barbate (Cádiz), España",
  manufacturer: "Valento Textile S.L.",
  manufacturerAddress: "Poligono PLAZA, calle Burtina 12, 50197 Zaragoza, Espana",
  manufacturerEmail: "info@valento.eu",
  euResponsiblePerson: "Valento Textile S.L.",
} as const;

export const LEGAL_LINKS = [
  { href: "/legal/reservas", label: "Condiciones de reserva" },
  { href: "/legal/envios", label: "Envios" },
  { href: "/legal/aviso-legal", label: "Aviso Legal" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/terminos", label: "Términos y condiciones" },
  { href: "/legal/devoluciones", label: "Devoluciones" },
  { href: "/legal/desistimiento", label: "Desistimiento" },
  { href: "/legal/accesibilidad", label: "Accesibilidad" },
] as const;
