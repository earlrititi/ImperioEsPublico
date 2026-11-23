import { withBase } from "../utils/basePath";

export const NAV_ITEMS = [
  { href: withBase("/tienda"), label: "Tienda" },
  {
    href: withBase("/sobre-nosotros"),
    label: "Memorial",
    target: "_self",
    rel: "noopener noreferrer",
  },
  { href: withBase("/papeles-y-tratados"), label: "Papeles y Tratados" },
  { href: withBase("/archivo"), label: "Archivo (próx.)" },
  { href: withBase("/foro"), label: "Foro (próx.)" },
  { href: withBase("/contacto"), label: "Contacto" },
];
