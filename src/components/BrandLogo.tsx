import type { JSX } from "preact";
import { BRAND, type BrandLogoVariant } from "../config/brand";
import { withBase } from "../utils/basePath";

export interface BrandLogoProps extends Omit<JSX.IntrinsicElements["img"], "src" | "srcSet" | "width" | "height" | "style"> {
  variant?: BrandLogoVariant;
  width?: number;
  decorative?: boolean;
}

/** Render an authorized asset as a complete, proportionally scaled image. */
export default function BrandLogo({
  variant = BRAND.defaultVariant,
  width = 180,
  decorative = false,
  alt = BRAND.name,
  loading = "eager",
  decoding = "async",
  ...attributes
}: BrandLogoProps) {
  const asset = BRAND.logos[variant];
  return (
    <img
      {...attributes}
      src={withBase(asset.svg)}
      data-brand-logo={variant}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? "true" : attributes["aria-hidden"]}
      width={width}
      height={Math.round(width * asset.height / asset.width)}
      loading={loading}
      decoding={decoding}
      style={{ maxWidth: "100%", height: "auto", objectFit: "contain" }}
    />
  );
}
