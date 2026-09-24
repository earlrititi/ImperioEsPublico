import { SITE } from "./site";

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-09-06",
  privacy: "2026-09-22",
  cookies: "2026-09-06",
  returns: "2026-09-10",
} as const;

export const LEGAL_BUSINESS = {
  ownerName: "Pablo Lorite Lozano",
  tradeName: "Imperio Español",
  taxId: "44061972K",
  registeredAddress: "Calle San Antonio Abad n.º 10, 1.º izquierda, 11005 Cádiz, España",
  registryDetails: "No procede: titular persona física no inscrita en el Registro Mercantil",
  legalEmail: SITE.contactEmail,
  returnsAddress: "Calle San Antonio Abad n.º 10, 1.º izquierda, 11005 Cádiz, España",
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
