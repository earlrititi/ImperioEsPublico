import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { BRAND } from "../src/config/brand";
import { SITE } from "../src/config/site";

test("all twelve authorized master files retain their recorded bytes and transparency", async () => {
  const manifest = JSON.parse(readFileSync("public/brand/manifest.json", "utf8"));
  assert.equal(manifest.source, "imperio_es_logos_png_svg.zip");
  assert.equal(Object.keys(manifest.files).length, 12);
  assert.equal(readdirSync("public/brand/logos").length, 12);
  for (const [name, expected] of Object.entries(manifest.files) as [string, { sha256: string; width: number; height: number }][]) {
    const bytes = readFileSync(join("public/brand/logos", name));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, name);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, expected.width, name);
    assert.equal(metadata.height, expected.height, name);
    assert.equal(metadata.hasAlpha, true, name);
  }
});

test("central brand paths resolve and email headers select official absolute HTTPS PNGs", () => {
  for (const logo of Object.values(BRAND.logos)) {
    for (const path of [logo.svg, logo.png]) assert.ok(readFileSync(`public${path}`).length);
  }
  assert.equal(BRAND.email.logos.light, new URL(BRAND.logos.principal.png, BRAND.url).href);
  assert.equal(BRAND.email.logos.dark, new URL(BRAND.logos.dark.png, BRAND.url).href);
  for (const path of Object.values(BRAND.email.logos)) assert.match(path, /^https:\/\/imperioes\.com\/brand\/logos\/.+\.png$/);
  assert.equal(SITE.defaultOgImage, BRAND.metadata.socialImage);
});

test("all touch/manifest/favicon sizes and social metadata have deployed assets", async () => {
  assert.deepEqual(readFileSync("public/favicon.svg"), readFileSync(`public${BRAND.logos.isotipo.svg}`));
  for (const [path, size] of [["favicon-16x16.png", 16], ["favicon-32x32.png", 32], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]] as const) {
    const metadata = await sharp(`public/${path}`).metadata();
    assert.equal(metadata.width, size, path);
    assert.equal(metadata.height, size, path);
    assert.equal(metadata.hasAlpha, true, path);
  }
  const social = await sharp(`public${BRAND.metadata.socialImage}`).metadata();
  assert.equal(social.width, 1200);
  assert.equal(social.height, 630);
  const manifest = JSON.parse(readFileSync("public/site.webmanifest", "utf8"));
  for (const icon of manifest.icons) assert.ok(readFileSync(`public/${icon.src.split("?")[0]}`).length);
});

test("current web surfaces cannot reintroduce legacy corporate logo URLs", () => {
  for (const file of ["src/components/Navigation.jsx", "src/components/HeroImperio.jsx", "src/components/Footer.jsx", "src/components/GlobalHomeMark.astro", "src/config/home.js", "src/layouts/Layout.astro", "src/pages/links.astro", "src/pages/tienda/index.astro"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /logo-redv2|imperio-espanol-footer-interactive|footer-dark-base/, file);
  }
});
