import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { parse } from "parse5";

// No live authentication, payment, analytics or database calls are permitted.
const local = fs.existsSync(".env.local") ? parseEnv(fs.readFileSync(".env.local", "utf8")) : {};
process.env.PUBLIC_SUPABASE_URL = local.PUBLIC_SUPABASE_URL || "https://fixture.supabase.co";
process.env.PUBLIC_SUPABASE_ANON_KEY = "fixture-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role";
globalThis.fetch = async () => { throw new Error("Unexpected network call in SEO fixture"); };
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const origin = "https://imperioes.com";
const report = { pages: [], editorialPending: [], checkedAssets: 0 };
const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
function all(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.childNodes ?? []).flatMap(child => all(child, predicate))];
}
const text = node => node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(text).join("");
const find = (document, tag, key, value) => all(document, node => node.namespaceURI === "http://www.w3.org/1999/xhtml" && node.tagName === tag && (!key || attr(node, key) === value));
async function request(route) {
  const response = await app.fetch(new Request(new URL(route, origin)));
  return { response, body: await response.text() };
}
const sitemap = await request("/sitemap.xml");
assert.equal(sitemap.response.status, 200);
const locations = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(locations).size, locations.length);
const articleUrls = locations.filter(url => url.includes("/papeles-y-tratados/"));
assert.ok(articleUrls.length >= 20);
for (const url of locations) {
  const { response, body } = await request(url);
  assert.equal(response.status, 200, url);
  const document = parse(body);
  assert.equal(attr(find(document, "html")[0], "lang"), "es", url);
  assert.equal(find(document, "h1").length, 1, `${url}: exactly one H1`);
  assert.equal(find(document, "main").length, 1, `${url}: one main landmark`);
  for (const image of find(document, "img")) assert.notEqual(attr(image, "alt"), undefined, `${url}: image alt missing`);
  assert.equal(find(document, "title").length, 1, url);
  assert.ok(text(find(document, "title")[0]).trim(), url);
  assert.ok(attr(find(document, "meta", "name", "description")[0], "content"), url);
  const canonical = find(document, "link", "rel", "canonical");
  assert.equal(canonical.length, 1, url);
  assert.equal(attr(canonical[0], "href"), url, url);
  assert.ok(!attr(find(document, "meta", "name", "robots")[0], "content").includes("noindex"), url);
  for (const property of ["og:title", "og:description", "og:url", "og:image", "og:type"]) {
    assert.equal(find(document, "meta", "property", property).length, 1, `${url}: ${property}`);
  }
  const scripts = find(document, "script", "type", "application/ld+json");
  assert.equal(scripts.length, 1, url);
  const graph = JSON.parse(text(scripts[0]))["@graph"];
  for (const type of ["WebSite", "WebPage"]) {
    assert.equal(graph.filter(node => node["@type"] === type).length, 1, `${url}: ${type}`);
  }
  const siteOrganization = graph.find(node => node["@id"] === "https://imperioes.com/#organization");
  assert.ok(siteOrganization && siteOrganization["@type"] === "Organization", `${url}: site organization`);
  const ids = graph.map(node => node["@id"]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, url);
  assert.equal(siteOrganization.sameAs.includes("https://x.com/Imperio_e"), true);
  const imageUrl = new URL(attr(find(document, "meta", "property", "og:image")[0], "content"));
  assert.ok(fs.existsSync(path.join(".vercel/output/static", decodeURIComponent(imageUrl.pathname))), `${url}: OG asset missing`);
  const article = graph.find(node => node["@type"] === "Article");
  if (article) {
    assert.equal(attr(find(document, "meta", "property", "og:type")[0], "content"), "article");
    assert.equal(graph.filter(node => node["@type"] === "BreadcrumbList").length, 1);
    assert.ok(find(document, "time", "datetime", article.datePublished).length > 0);
    assert.ok(!("articleBody" in article));
    assert.ok(Array.isArray(article.author) && article.author.length > 0, `${url}: author missing`);
    assert.ok(article.datePublished, `${url}: publication date missing`);
    assert.ok(article.description?.trim(), `${url}: public description missing`);
    const headings = all(document, node => /^h[1-6]$/.test(node.tagName ?? ""));
    let previous = 0;
    for (const heading of headings) {
      const level = Number(heading.tagName[1]);
      assert.ok(level <= previous + 1, `${url}: heading jump to ${heading.tagName}`);
      previous = level;
    }
    const related = all(document, node => (attr(node, "class") || "").includes("article-page__related"));
    assert.equal(related.length, 1, `${url}: related links missing`);
    if (!article.isAccessibleForFree) {
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.ok(!body.includes("class=\"article-body\""), `${url}: unauthorized body`);
      assert.ok(body.includes("Articulo para suscriptores"));
    }
  }
  report.pages.push({ url, status: response.status, article: Boolean(article), bytes: Buffer.byteLength(body) });
}
for (const route of ["/archivo", "/foro", "/comunidad", "/biblioteca", "/ensayos", "/presente", "/efemerides", "/rutas", "/login", "/registro", "/biblioteca?category=efemeride", "/papeles-y-tratados?q=Felipe"]) {
  const { body } = await request(route);
  assert.ok(attr(find(parse(body), "meta", "name", "robots")[0], "content")?.includes("noindex"), route);
  assert.ok(!locations.includes(`${origin}${route}`), route);
}
assert.ok(locations.includes(`${origin}/politica-editorial`));
assert.ok(locations.includes(`${origin}/autores/imperio-espanol`));
const policy = await request("/politica-editorial");
assert.ok(policy.body.includes("No se pueden garantizar las citas de una IA"));
assert.ok(policy.body.includes("https://developers.google.com/search/docs/appearance/ai-features"));
for (const url of articleUrls) {
  const oldPath = new URL(url).pathname.replace("/papeles-y-tratados/", "/articulos/");
  const { response } = await request(oldPath);
  assert.equal(response.status, 301, oldPath);
  assert.equal(new URL(response.headers.get("location"), origin).href, url);
}
for (const route of ["/metodologia", "/autores/pendiente", "/siglo-de-oro"]) {
  assert.equal((await request(route)).response.status, 404, `Do not publish empty pages: ${route}`);
}
for (const route of ["rutas/imperios-memoria", "tienda/2026-01-31-cuaderno-campo"]) {
  const html = fs.readFileSync(path.join(".vercel/output/static", route, "index.html"), "utf8");
  assert.ok(attr(find(parse(html), "meta", "name", "robots")[0], "content")?.includes("noindex"), route);
  assert.ok(!locations.includes(`${origin}/${route}`));
}
const feed = await request("/feed.xml");
assert.equal(feed.response.status, 200);
assert.equal([...feed.body.matchAll(/<item>/g)].length, 6);
assert.ok(!feed.body.includes("cruz-de-borgona-historia"));
assert.ok(!feed.body.includes("content:encoded"));
const robots = fs.readFileSync("public/robots.txt", "utf8");
assert.match(robots, /Sitemap: https:\/\/imperioes.com\/sitemap.xml/);
assert.ok(!robots.includes("Disallow: /"));

// Inspect the rendered free article, not only metadata or client JavaScript.
const example = await request("/papeles-y-tratados/el-imperio-donde-nunca-se-pone-el-sol");
const exampleDoc = parse(example.body);
const articleText = text(find(exampleDoc, "article")[0]);
for (const term of ["Felipe II", "1556", "Madrid", "Referencias"]) assert.ok(articleText.includes(term), term);
assert.ok(find(exampleDoc, "h2").length > 3);

function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(m?js|cjs|json|html|txt|map|xml)$/.test(entry.name)) {
      assert.ok(!fs.readFileSync(file, "utf8").includes("Un martirio convertido en emblema"), `Premium leak: ${file}`);
      report.checkedAssets++;
    }
  }
}
scan(".vercel/output/static");
fs.mkdirSync(".astro", { recursive: true });
fs.writeFileSync(".astro/seo-audit.json", JSON.stringify(report, null, 2));
console.log(`SEO: ${report.pages.length} indexable pages, ${articleUrls.length} articles, 6 feed entries, ${report.checkedAssets} public artifacts checked. Editorial gaps: ${report.editorialPending.length}. Report: .astro/seo-audit.json`);
