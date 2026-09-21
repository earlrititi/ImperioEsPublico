import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const outputRoot = path.resolve(".vercel/output/static");
const imageRoot = path.join(outputRoot, "images");
const retainedPngFiles = new Set(["logo-redv2.png", "subscription-x-brush.png"]);
const unusedImageFiles = new Set([
  "cuadros-explicativos-camiseta-2x.webp",
  "cuadros-explicativos-camiseta.webp",
  "dark-footer-ie.webp",
  "imperio-espanol-footer.webp",
  "red_hamburguer_final.webp",
  "red_hamburguer_phone.webp",
]);
let removedFiles = 0;
let removedBytes = 0;

const removeFile = async (filePath) => {
  const metadata = await stat(filePath);
  await rm(filePath);
  removedFiles += 1;
  removedBytes += metadata.size;
};

const pruneImages = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await pruneImages(entryPath);
        return;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const relativePath = path.relative(imageRoot, entryPath).replaceAll("\\", "/");
      const isSourcePng = extension === ".png" && !retainedPngFiles.has(entry.name);
      const isArticleSource =
        extension === ".jpg" && entryPath.startsWith(path.join(imageRoot, "articulos"));

      if (isSourcePng || isArticleSource || unusedImageFiles.has(relativePath)) {
        await removeFile(entryPath);
      }
    })
  );
};

try {
  await pruneImages(imageRoot);
  await removeFile(path.join(outputRoot, "Manifiesto IE.pdf")).catch(() => undefined);
  console.log(
    `Pruned ${removedFiles} unused production assets (${(removedBytes / 1024 / 1024).toFixed(1)} MB).`
  );
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
