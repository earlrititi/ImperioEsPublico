// Sole source of truth for the authorized files in imperio_es_logos_png_svg.zip.
// Keep source files intact; choose a supplied variant instead of recoloring it.
const logo = (base: string, width = 1254, height = 1254) => ({
  svg: `/brand/logos/${base}.svg`,
  png: `/brand/logos/${base}.png`,
  width,
  height,
});

const logos = {
  principal: logo("imperio_es_principal"),
  dark: logo("imperio_es_fondos_oscuros"),
  monochromeBlack: logo("imperio_es_monocromatico_negro"),
  monochromeWhite: logo("imperio_es_monocromatico_blanco"),
  isotipo: logo("imperio_es_isotipo", 981, 904),
  typographic: logo("imperio_es_tipografico", 1081, 355),
} as const;

export type BrandLogoVariant = keyof typeof logos;
const url = "https://imperioes.com";
const assetUrl = (path: string) => new URL(path, url).href;

export const BRAND = {
  name: "Imperio Español",
  shortName: "Imperio E",
  url,
  defaultVariant: "principal" as const,
  logos,
  email: {
    logos: {
      light: assetUrl(logos.principal.png),
      dark: assetUrl(logos.dark.png),
    },
    width: logos.principal.width,
    height: logos.principal.height,
  },
  metadata: {
    organizationLogo: assetUrl(logos.principal.png),
    socialImage: "/brand/social/imperio-espanol-og.png",
    socialImageAlt: "Logotipo oficial de Imperio Español",
    favicon: logos.isotipo.svg,
    iconVersion: "20261114",
  },
} as const;
