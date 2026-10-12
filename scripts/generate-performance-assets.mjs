import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("public/images");
const mobilePreloaderRoot = path.join(root, "preloader", "Preload movil");
const articleRoot = path.join(root, "articulos");

const writeVariant = async ({ source, destination, width, format, quality }) => {
  const output = sharp(source).resize({ width, withoutEnlargement: true });
  const encoded = format === "avif"
    ? output.avif({ quality, effort: 6 })
    : output.webp({ quality, effort: 6, smartSubsample: true });

  await mkdir(path.dirname(destination), { recursive: true });
  await encoded.toFile(destination);
};

const mobileFrames = [
  "01_preloader_phone",
  "02_preloader_phone",
  "preload_archivo_phone",
  "04_preloader_phone",
  "05_preloader_phone",
  "03_preloader_phone",
];

for (const name of mobileFrames) {
  for (const width of [480, 640]) {
    for (const [format, quality] of [["avif", 45], ["webp", 68]]) {
      await writeVariant({
        source: path.join(mobilePreloaderRoot, `${name}.png`),
        destination: path.join(mobilePreloaderRoot, `${name}-${width}.${format}`),
        width,
        format,
        quality,
      });
    }
  }
}

for (const width of [480, 768]) {
  for (const [format, quality] of [["avif", 48], ["webp", 70]]) {
    await writeVariant({
      source: path.join(mobilePreloaderRoot, "06_preloader_phone.png"),
      destination: path.join(mobilePreloaderRoot, `06_preloader_phone-${width}.${format}`),
      width,
      format,
      quality,
    });
  }
}

const articleFiles = await readdir(articleRoot);
const articleSources = articleFiles.filter((name) => name.endsWith("-1024.webp"));
for (const name of articleSources) {
  const source = path.join(articleRoot, name);
  const base = name.slice(0, -"-1024.webp".length);
  await writeVariant({
    source,
    destination: path.join(articleRoot, `${base}-768.avif`),
    width: 768,
    format: "avif",
    quality: 50,
  });
  await writeVariant({
    source,
    destination: path.join(articleRoot, `${base}-768.webp`),
    width: 768,
    format: "webp",
    quality: 74,
  });
}

await writeVariant({
  source: path.join(root, "logo-redv2.png"),
  destination: path.join(root, "logo-redv2-320.webp"),
  width: 320,
  format: "webp",
  quality: 80,
});
await writeVariant({
  source: path.join(root, "camiseta-imperio-frontal.webp"),
  destination: path.join(root, "camiseta-imperio-frontal-640.avif"),
  width: 640,
  format: "avif",
  quality: 50,
});
await writeVariant({
  source: path.join(root, "camiseta-imperio-frontal.webp"),
  destination: path.join(root, "camiseta-imperio-frontal-640.webp"),
  width: 640,
  format: "webp",
  quality: 72,
});
await writeVariant({
  source: path.join(root, "camiseta-imperio-atras.webp"),
  destination: path.join(root, "camiseta-imperio-atras-640.avif"),
  width: 640,
  format: "avif",
  quality: 50,
});
await writeVariant({
  source: path.join(root, "camiseta-imperio-atras.webp"),
  destination: path.join(root, "camiseta-imperio-atras-640.webp"),
  width: 640,
  format: "webp",
  quality: 72,
});

for (const name of ["museo-camiseta-front", "museo-camiseta-back"]) {
  for (const width of [640, 960]) {
    for (const [format, quality] of [["avif", 50], ["webp", 72]]) {
      await writeVariant({
        source: path.join(root, `${name}.webp`),
        destination: path.join(root, `${name}-${width}.${format}`),
        width,
        format,
        quality,
      });
    }
  }
}

for (const width of [640, 960]) {
  for (const [format, quality] of [["avif", 50], ["webp", 72]]) {
    await writeVariant({
      source: path.join(root, "cuadros-explicativos-camiseta.webp"),
      destination: path.join(root, `cuadros-explicativos-camiseta-${width}.${format}`),
      width,
      format,
      quality,
    });
  }
}

for (const width of [960, 1440]) {
  for (const [format, quality] of [["avif", 52], ["webp", 74]]) {
    await writeVariant({
      source: path.join(root, "explicacion-camiseta.webp"),
      destination: path.join(root, `explicacion-camiseta-${width}.${format}`),
      width,
      format,
      quality,
    });
  }
}

await writeVariant({
  source: path.join(root, "ejercito-blanco_upscaled_2x.webp"),
  destination: path.join(root, "ejercito-blanco_upscaled_2x-960.avif"),
  width: 960,
  format: "avif",
  quality: 50,
});

for (const width of [640, 960]) {
  for (const [format, quality] of [["avif", 50], ["webp", 74]]) {
    await writeVariant({
      source: path.join(root, "memorial-foreground.webp"),
      destination: path.join(root, `memorial-foreground-${width}.${format}`),
      width,
      format,
      quality,
    });
  }
  await writeVariant({
    source: path.join(root, "memorial-letters.webp"),
    destination: path.join(root, `memorial-letters-${width}.webp`),
    width,
    format: "webp",
    quality: 82,
  });
}
await writeVariant({
  source: path.join(root, "subscription-x-brush.png"),
  destination: path.join(root, "subscription-x-brush.webp"),
  width: 128,
  format: "webp",
  quality: 80,
});

console.log(`Generated ${mobileFrames.length * 4 + 4 + articleSources.length * 2 + 29} optimized assets.`);
