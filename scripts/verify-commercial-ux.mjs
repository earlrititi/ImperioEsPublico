import assert from "node:assert/strict";
import { Socket } from "node:net";
import { parse, parseFragment, serialize } from "parse5";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, sep, extname } from "node:path";

Socket.prototype.connect = () => { throw Error("External connections disabled in commercial UX fixtures"); };
Object.assign(process.env, { PUBLIC_SITE_URL: "https://imperioes.com", PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", STRIPE_SECRET_KEY: "sk_test_fixture",
  RESERVATION_MODE: "false", SHIRT_SALES_APPROVED: "true", STRIPE_LIVE_CHECKOUT_ENABLED: "false", COMMERCE_EMAIL_MODE: "disabled" });
const json = (value, status=200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const path = new URL(request.url).pathname;
  if (path === "/auth/v1/user") return json({message:"No fixture user"},401);
  if (request.method !== "GET") throw Error("Mutations disabled in visual fixture");
  if (path === "/rest/v1/cms_articles") return json([]);
  if (path === "/rest/v1/products") return json({id:"11111111-1111-4111-8111-111111111111"});
  if (path === "/rest/v1/product_prices") return json({amount:2999});
  if (path === "/rest/v1/product_variants") return json(["S","M","L","XL","XXL"].map(name=>({sku:`IE-CAMISETA-IMPERIAL-${name}`,name,color:"Diseno Imperial",available_stock:name==="XL"?0:7})));
  if (path === "/rest/v1/commerce_campaign") return json({id:"shirt-first-edition",purchase_activated:true,purchase_open_at:null,reservations_open_at:null,max_reservation_quantity:null,purchase_window_hours:24});
  throw Error(`Unexpected fixture request: ${path}`);
};
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const page = async path => {
  const response = await app.fetch(new Request(`https://imperioes.com${path}`));
  assert.equal(response.status,200,path);
  return response.text();
};
const inventory = await (await app.fetch(new Request("https://imperioes.com/api/reservations/inventory"))).json();
assert.equal(inventory.salesEnabled,true);
assert.equal(inventory.unitPrice,2699);
assert.equal(inventory.shippingPerUnit,300);
assert.equal(inventory.campaign.edition_total,undefined);
assert.equal(inventory.variants.find(v=>v.name==="XL").available,false);
assert.equal(inventory.variants.find(v=>v.name==="M").available,true);
assert.doesNotMatch(JSON.stringify(inventory.variants),/stock|quantity|physical|sold/);
const home = await page("/");
const document = parse(home);
const elements = [];
const walk = node => { if(node.tagName)elements.push(node); for(const child of node.childNodes??[])walk(child); };
walk(document);
const index = className => elements.findIndex(node => node.attrs?.some(a=>a.name==="class"&&a.value.split(/\s+/).includes(className)));
assert.ok(index("hero-imperio")>=0);
assert.ok(index("home-shirt")>index("hero-imperio"));
assert.ok(index("services-section")>index("home-shirt"));
assert.ok(home.includes("COMPRAR AHORA"));
for (const path of ["/legal/aviso-legal", "/legal/privacidad", "/legal/cookies", "/legal/terminos", "/legal/envios", "/legal/devoluciones", "/legal/desistimiento"]) {
  const html = await page(path);
  assert.match(html, /Adrian Lopez Oliva/);
  assert.match(html, /44067163Z/);
  assert.match(html, /11160 Barbate/);
  assert.doesNotMatch(html, /Version 2026-09-10|44061972K|San Antonio Abad/);
}
const store = await page("/tienda");
assert.match(store, /COMPRAR AHORA/);
assert.match(store, /26,99/);
assert.doesNotMatch(store, /available_stock|physical_stock|reserved_stock/);
for (const path of ["/newsletter","/newsletter/","/tienda","/carrito","/suscribirse","/reservas?cart=1","/recursos/7-historias-del-siglo-de-oro"]) {
  const html=await page(path);
  const containsPopup=node=>node.attrs?.some(a=>a.name==="data-tshirt-lead") || (node.childNodes??[]).some(containsPopup);
  assert.equal(containsPopup(parse(html)),false,`${path} must not contain an offer popup`);
  assert.match(html,/TU PRIVACIDAD IMPORTA/);
  assert.match(html,/Permitir analítica/);
}
const booklet = await page("/recursos/7-historias-del-siglo-de-oro");
assert.match(booklet,/Descargar PDF/);
assert.match(booklet,/Juan Latino/);
assert.match(booklet,/noindex, follow/);
assert.equal(readFileSync(".vercel/output/static/recursos/7-historias-del-siglo-de-oro.pdf").subarray(0,5).toString(),"%PDF-");
console.log("Compiled home order, original Hero, cart route, stock privacy, sold-out state, cookie controls and shopping popup exclusion passed. Fixtures only; no live services or payments.");
if (process.argv.includes("--serve")) {
  const root = resolve(".vercel/output/static");
  const types={".css":"text/css",".js":"text/javascript",".webp":"image/webp",".avif":"image/avif",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".ico":"image/x-icon",".pdf":"application/pdf"};
  createServer(async (req,res)=>{
    try {
      const url=new URL(req.url,"http://127.0.0.1:4328");
      const file=resolve(root,`.${decodeURIComponent(url.pathname)}`);
      if(file.startsWith(root+sep)&&existsSync(file)&&statSync(file).isFile()) {
        res.writeHead(200,{"Content-Type":types[extname(file)]??"application/octet-stream"});res.end(readFileSync(file));return;
      }
      if(req.method!=="GET"){res.writeHead(405);res.end("Visual fixture: changes and payments disabled");return;}
      if(url.pathname==="/api/reservations/inventory"){res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify(inventory));return;}
      const response=await app.fetch(new Request(`https://imperioes.com${url.pathname}${url.search}`));
      let body=await response.text();
      if(response.headers.get("content-type")?.includes("text/html")) {
        const doc=parse(body), nodes=[];
        const visit=n=>{if(n.tagName==="body")nodes.push(n);for(const c of n.childNodes??[])visit(c);};visit(doc);
        const banner=parseFragment('<div style="position:fixed;bottom:0;right:0;z-index:20000;background:#fff;color:#111;padding:5px 10px;font:12px Arial">TEST LOCAL · DATOS SINTÉTICOS · PAGOS DESACTIVADOS</div>');
        if(nodes[0])nodes[0].childNodes.push(...banner.childNodes);
        body=serialize(doc);
      }
      res.writeHead(response.status,{"Content-Type":response.headers.get("content-type")??"text/plain"});res.end(body);
    }catch{res.writeHead(500);res.end("Visual fixture unavailable");}
  }).listen(4328,"127.0.0.1",()=>console.log("Synthetic visual preview: http://127.0.0.1:4328. No real data or payment API."));
}
