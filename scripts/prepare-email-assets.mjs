import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

// Deterministic resizing/compression of the approved originals, never generated artwork.
const source = process.argv[2];
if (!source) throw Error("Pass the extracted kit assets directory.");
const destination = resolve("public/images/email/pergamino-v1");
const approvedHeader = resolve("docs/email-assets/cabecera-v2.svg");
const approvedBody = resolve("docs/email-assets/extension-v2.svg");
await mkdir(destination, { recursive: true });
const manifest = [];
for (let [input, output] of [["cabecera_original.png", "cabecera.jpg"], ["titulo_sin_texto.png", "titulo.jpg"], ["fondo_aprobado_sin_textos.png", "firma-nao-v2.jpg"], ["extension_cuerpo_repetible.png", "extension.png"]]) {
  const customHeader = output === "cabecera.jpg" && existsSync(approvedHeader);
  const customBody = output === "extension.png" && existsSync(approvedBody);
  if (customHeader) { input = "docs/email-assets/cabecera-v2.svg"; output = "cabecera-v2.png"; }
  if (customBody) { input = "docs/email-assets/extension-v2.svg"; output = "extension-v2.png"; }
  const original = await readFile(customHeader ? approvedHeader : customBody ? approvedBody : join(source, input));
  let pipeline = sharp(original);
  // The old footer started at y=890 and cut off the mast tops. Start before the
  // complete vessel, on blank parchment; preserve the original signature/frame.
  const footerCrop = output === "firma-nao-v2.jpg" ? { left: 0, top: 700, width: 1122, height: 702 } : null;
  if (footerCrop) pipeline = pipeline.extract(footerCrop);
  pipeline = pipeline.resize({ width: 600, withoutEnlargement: true });
  pipeline = output.endsWith(".jpg") ? pipeline.jpeg({ quality: 88, mozjpeg: true }) : pipeline.png({ compressionLevel: 9 });
  const data = await pipeline.toBuffer(), metadata = await sharp(data).metadata();
  await writeFile(join(destination, output), data);
  manifest.push({ input, output, sourceSha256: createHash("sha256").update(original).digest("hex"), sha256: createHash("sha256").update(data).digest("hex"), width: metadata.width, height: metadata.height, bytes: data.length, ...(footerCrop ? { crop: footerCrop } : {}) });
}
await writeFile(join(destination, "manifest.json"), JSON.stringify({ source: "Approved KIT_IMPERIO_E_PERGAMINO_ENTREGA_DASHBOARD", transformations: "resize to rendered width, lossless PNG or JPEG quality 88; no redrawing", assets: manifest }, null, 2) + "\n");
console.log(JSON.stringify(manifest.map(({ output, width, height, bytes }) => ({ output, width, height, bytes }))));
