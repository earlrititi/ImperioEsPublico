import { mkdir } from "node:fs/promises";
import sharp from "sharp";

// Deterministic composition: complete, proportionally scaled official artwork.
// No redrawing, cropping, filters, text substitutions or generated imagery.
await mkdir("public/brand/social", { recursive: true });
const logo = await sharp("public/brand/logos/imperio_es_principal.svg")
  .resize(540, 540, { fit: "contain" }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#fffdf8" } })
  .composite([{ input: logo, gravity: "center" }])
  .png({ compressionLevel: 9 }).toFile("public/brand/social/imperio-espanol-og.png");
console.log("Generated 1200x630 social card with the intact official principal logo.");
