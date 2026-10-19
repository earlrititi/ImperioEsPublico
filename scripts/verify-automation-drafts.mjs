import assert from "node:assert/strict";
import { Socket } from "node:net";
import { existsSync, readFileSync, statSync } from "node:fs";
import { parseEnv } from "node:util";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { AUTOMATION_DEFAULTS } from "../src/lib/email-automations.ts";

Socket.prototype.connect = () => { throw Error("Network disabled in automation fixtures"); };
const publicUrl = parseEnv(readFileSync(".env.local", "utf8")).PUBLIC_SUPABASE_URL;
const project = new URL(publicUrl).hostname.split(".")[0];
Object.assign(process.env, { PUBLIC_SITE_URL: "https://imperioes.com", PUBLIC_SUPABASE_URL: publicUrl,
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", COMMERCE_EMAIL_MODE: "disabled",
  RATE_LIMIT_SECRET: "fixture-rate-limit-secret-long-enough" });
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const user = { id: "24f42701-98e0-4716-810c-363ae1cc8fa2", email: "fixture@example.invalid", email_confirmed_at: "2026-10-01T00:00:00Z",
  aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
function fixtureCookie() {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,exp:expires,role:"authenticated"})}.fixture`;
  return `sb-${project}-auth-token=base64-${encode({access_token:token,refresh_token:"fixture",token_type:"bearer",expires_at:expires,expires_in:3600,user})}`;
}
let forged = false, missing = false, writes = 0;
const drafts = new Map();
const json = (value, status = 200) => new Response(JSON.stringify(value), {status,headers:{"Content-Type":"application/json"}});
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const path = new URL(request.url).pathname;
  if (path === "/auth/v1/user") return json(forged ? { ...user, id: "00000000-0000-4000-8000-000000000001", user_metadata: {role:"admin"} } : user);
  if (path === "/auth/v1/token") return json({error:"invalid_grant",error_description:"Synthetic sessions must not refresh"},400);
  if (path === "/rest/v1/rpc/consume_rate_limit") return json(true);
  if (path === "/rest/v1/rpc/marketing_automation_stats") return json([]);
  if (path === "/rest/v1/marketing_automation_runtime") return json({enrollment_starts_at:null});
  if (path === "/rest/v1/marketing_automation_drafts") return missing ? json({code:"PGRST205",message:"fixture missing table"},404) : json([...drafts.values()]);
  if (path === "/rest/v1/rpc/save_marketing_automation_draft") {
    const body = await request.json();
    const previous = drafts.get(body.p_key);
    if ((previous?.revision ?? 0) !== body.p_revision) return json({message:"REQUEST_CONFLICT"},400);
    writes++;
    drafts.set(body.p_key, {key:body.p_key,steps:body.p_steps,revision:body.p_revision+1});
    return json(body.p_revision+1);
  }
  throw Error(`Unexpected fixture request: ${path}`);
};
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const url = "https://imperioes.com/api/admin/automations";
const request = (body, authenticated = true, origin = "https://imperioes.com") => app.fetch(new Request(url, {
  method: body ? "POST" : "GET", headers: { ...(authenticated ? {cookie:fixtureCookie()} : {}), ...(body ? {"Content-Type":"application/json",origin} : {}) },
  body: body ? JSON.stringify(body) : undefined,
}));
assert.equal((await request(null, false)).status, 403);
forged = true; assert.equal((await request(null)).status, 403); forged = false;
const response = await request(null);
assert.match(response.headers.get("Cache-Control"), /\bno-store\b/);
let result = await response.json(); assert.equal(response.status,200,JSON.stringify(result)); assert.equal(result.items.length, 6); assert.equal(result.sendsEnabled, false);
const definition = AUTOMATION_DEFAULTS[0];
const body = {key:definition.key,steps:definition.steps,revision:0,action:"preview",step:0};
result = await (await request(body)).json(); assert.match(result.html,/Hola Lector/); assert.match(result.html,/Dar de baja/); assert.equal(writes,0);
assert.equal((await request({...body,action:"activate"})).status,409); assert.equal(writes,0);
assert.notEqual((await request({...body,action:"save"},true,"https://evil.example")).status,200); assert.equal(writes,0);
result = await (await request({...body,action:"save"})).json(); assert.equal(result.revision,1); assert.equal(result.sendsEnabled,false); assert.equal(writes,1);
assert.equal((await request({...body,action:"save"})).status,409); assert.equal(writes,1);
const altered = structuredClone(body); altered.steps[0].mail.content = "{{email}}";
assert.equal((await request(altered)).status,409); assert.equal(writes,1);
missing = true; result = await (await request(null)).json(); assert.equal(result.storageReady,false); assert.equal(result.sendsEnabled,false);
assert.equal(writes,1);
const stats = await app.fetch(new Request("https://imperioes.com/api/admin/automation-stats", { headers: { cookie:fixtureCookie() } }));
assert.equal(stats.status,200); assert.deepEqual((await stats.json()).items,[]);
assert.equal((await app.fetch(new Request("https://imperioes.com/api/admin/automation-stats"))).status,403);
console.log("Automation draft routes: admin identity, forged roles, private caching, preview, no activation, CSRF, revision conflicts and missing migration passed. No network or real emails.");

if (process.argv.includes("--serve")) {
  missing = false; drafts.clear();
  const root = resolve(".vercel/output/static");
  const types = {".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".png":"image/png"};
  createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:4329");
      const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (req.method === "GET" && file.startsWith(root + sep) && existsSync(file) && statSync(file).isFile()) {
        res.writeHead(200,{"Content-Type":types[extname(file)] ?? "application/octet-stream"}); res.end(readFileSync(file)); return;
      }
      if (!["/admin/automatizaciones", "/api/admin/automations", "/api/admin/automation-stats"].includes(url.pathname) ||
        !["GET","POST"].includes(req.method) || (req.method === "POST" && url.pathname !== "/api/admin/automations")) {
        res.writeHead(405); res.end("Synthetic automation editor only; email and payment routes disabled"); return;
      }
      if (req.headers.origin && req.headers.origin !== "http://127.0.0.1:4329") {
        res.writeHead(403); res.end("Origin not allowed"); return;
      }
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 65536) throw Error("BODY_TOO_LARGE"); chunks.push(chunk); }
      const response = await app.fetch(new Request(`https://imperioes.com${url.pathname}`, {method:req.method,
        headers:{cookie:fixtureCookie(),"Content-Type":"application/json",origin:"https://imperioes.com"},
        ...(req.method === "POST" ? {body:Buffer.concat(chunks).toString("utf8")} : {})}));
      let body = await response.text();
      if (response.headers.get("Content-Type")?.includes("text/html")) body = body.replace("</body>",
        '<div style="position:fixed;bottom:0;right:0;z-index:20000;background:#fff;color:#111;padding:5px 10px;font:12px Arial">TEST LOCAL - BORRADORES SINTETICOS - NO SE ENVIAN CORREOS</div></body>');
      res.writeHead(response.status,{"Content-Type":response.headers.get("Content-Type") ?? "text/plain","Cache-Control":"no-store"});res.end(body);
    } catch { res.writeHead(500); res.end("Synthetic editor unavailable"); }
  }).listen(4329,"127.0.0.1",()=>console.log("Synthetic automation editor: http://127.0.0.1:4329/admin/automatizaciones. No real users or emails."));
}
