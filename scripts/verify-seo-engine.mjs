import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Socket } from "node:net";
Socket.prototype.connect = () => { throw Error("No real network in SEO route fixtures"); };
const local = parseEnv(readFileSync(".env.local", "utf8")), project = new URL(local.PUBLIC_SUPABASE_URL).hostname.split(".")[0];
Object.assign(process.env, { PUBLIC_SITE_URL: "https://imperioes.com", PUBLIC_SUPABASE_URL: local.PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY: "fixture", SUPABASE_SERVICE_ROLE_KEY: "fixture", RATE_LIMIT_SECRET: "fixture", SEO_ENGINE_ENABLED: "false" });
delete process.env.SEO_AI_API_KEY; delete process.env.SEO_AI_MODEL;
const user = { id: "24f42701-98e0-4716-810c-363ae1cc8fa2", email: "fixture@example.invalid", email_confirmed_at: "2026-10-01T00:00:00Z", aud: "authenticated", role: "authenticated" };
const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url"), exp = Math.floor(Date.now() / 1000) + 3600;
const cookie = `sb-${project}-auth-token=base64-${encode({ access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp })}.fixture`, refresh_token: "fixture", token_type: "bearer", expires_at: exp, expires_in: 3600, user })}`;
const settings = { paused: true, mailPaused: true, scheduleEnabled: false, monthlyBudgetCents: 0, maxTokens: 10000, maxOutputTokens: 3000, dailyGenerations: 2, weeklyDrafts: 2, weeklyImprovements: 3, monthlyCollaborators: 5, retentionDays: 90 };
let forged = false, writes = 0, failMail = true;
const opportunities = new Map(), records = new Map(), jobs = new Map(), mailAttempts = [];
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init), u = new URL(req.url), path = u.pathname;
  if (path === "/auth/v1/user") return Response.json(forged ? { ...user, id: "00000000-0000-4000-8000-000000000001", user_metadata: { role: "admin" } } : user);
  if (path === "/rest/v1/rpc/consume_rate_limit") return Response.json(true);
  if (path === "/rest/v1/seo_engine_config") return Response.json({ settings, revision: 1, updated_by: user.id });
  if (path === "/rest/v1/cms_articles") return Response.json([]);
  if (path === "/rest/v1/seo_opportunities") return Response.json([...opportunities.values()]);
  if (path === "/rest/v1/seo_records") return Response.json([...records.values()]);
  if (path === "/rest/v1/seo_reviews") return Response.json([]);
  if (path === "/rest/v1/seo_jobs") {
    if (req.method === "POST") { const b = await req.json(); const old = [...jobs.values()].find(j => j.job_key === b.job_key); if (!old) { const id = "33333333-3333-4333-8333-333333333333"; jobs.set(id, { ...b, id, status: "pending", attempts: 0 }); } return Response.json([]); }
    const id = u.searchParams.get("id")?.replace(/^eq\./, "");
    if (req.method === "PATCH") { const b = await req.json(), j = jobs.get(id); if (!j) return Response.json([]); Object.assign(j, b); return Response.json([{ id }]); }
    return Response.json([...jobs.values()].filter(j => u.searchParams.get("status") === "eq.succeeded" ? j.status === "succeeded" : true));
  }
  if (path === "/rest/v1/rpc/seo_save") {
    const b = await req.json(); assert.equal(b.p_actor, user.id); writes++;
    const row = { id: b.p_id, data: b.p_data, status: "proposed", revision: b.p_revision + 1, kind: b.p_kind };
    (b.p_kind === "opportunity" ? opportunities : records).set(row.id, row); return Response.json(row);
  }
  if (path === "/rest/v1/rpc/seo_claim_job") {
    const b = await req.json(), j = [...jobs.values()].find(j => j.kind === b.p_kind && j.status === "pending");
    if (!j) return Response.json([]); j.status = "processing"; j.claim_id = "44444444-4444-4444-8444-444444444444"; j.attempts++; return Response.json([j]);
  }
  if (u.hostname === "api.resend.com" && path === "/emails" && req.method === "POST") {
    const body = await req.json(); mailAttempts.push({ body, key: req.headers.get("idempotency-key") });
    return failMail ? Response.json({ name: "application_error", message: "Controlled provider failure" }, { status: 500 }) : Response.json({ id: "fixture-provider-id" });
  }
  if (u.hostname === "api.resend.com" && path === "/emails/fixture-provider-id") return Response.json({ id: "fixture-provider-id", last_event: "delivered" });
  throw Error(`Unexpected fixture request: ${req.method} ${path}`);
};
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const base = "https://imperioes.com/api/admin/seo";
const call = (body, authenticated = true, origin = "https://imperioes.com", suffix = "") => app.fetch(new Request(base + suffix, { method: body ? "POST" : "GET", headers: { ...(authenticated ? { cookie } : {}), ...(body ? { Origin: origin, "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));
assert.equal((await call(null, false)).status, 403); forged = true; assert.equal((await call(null)).status, 403); forged = false;
let r = await call(null); assert.equal(r.status, 200); let d = await r.json(); assert.equal(d.inventory.length, 23); assert.ok(d.graph.length > 0); assert.equal(d.queries.length, 24); assert.equal(d.connections.generation, "not_configured");
assert.equal(r.headers.get("cache-control"), "no-store");
r = await call(null, true, "", "?action=publish"); assert.equal(r.status, 200); assert.equal(writes, 0);
r = await call({ action: "settings", revision: 1, data: settings }, true, "https://evil.example"); assert.equal(r.status, 403); assert.equal(writes, 0);
r = await call({ action: "settings", revision: 1, data: { ...settings, monthlyBudgetCents: -1 } }); assert.equal(r.status, 400); assert.equal(writes, 0);
r = await call({ action: "settings", revision: 1, data: settings }); assert.equal(r.status, 200); assert.equal(writes, 1);
r = await call({ action: "generate", id: "11111111-1111-4111-8111-111111111111", revision: 1 }); assert.equal(r.status, 409); assert.equal((await r.json()).code, "SEO_PROVIDER_NOT_CONFIGURED");
r = await call({ action: "review", id: "11111111-1111-4111-8111-111111111111", revision: 1, decision: "publish", confirmed: false }); assert.notEqual(r.status, 200); assert.equal(writes, 1);
r = await call({ action: "opportunities" }); assert.equal(r.status, 200); assert.ok(opportunities.size >= 3);
assert.equal((await call(null, false, "", "?review=11111111-1111-4111-8111-111111111111")).status, 403);
const cron = await app.fetch(new Request("https://imperioes.com/api/seo-maintenance", { method: "POST" })); assert.equal(cron.status, 403);
const page = await app.fetch(new Request("https://imperioes.com/admin/seo")); assert.equal(page.status, 302);
const adminPage = await app.fetch(new Request("https://imperioes.com/admin/seo", { headers: { cookie } })); assert.equal(adminPage.status, 200); assert.equal(adminPage.headers.get("cache-control"), "private, no-store"); assert.match(await adminPage.text(), /SEO y crecimiento/);
process.env.RESEND_API_KEY = "fixture"; settings.mailPaused = false;
r = await call({ action: "test_notice", id: "55555555-5555-4555-8555-555555555555", confirmed: true }); assert.equal(r.status, 200);
let notice = [...jobs.values()][0]; assert.equal(notice.status, "failed"); assert.equal(mailAttempts.length, 1); assert.deepEqual([mailAttempts[0].body.to].flat(), ["imperio_e@hotmail.com"]);
r = await call({ action: "retry_notice", id: notice.id, confirmed: true }); assert.equal(r.status, 200);
failMail = false; r = await call({ action: "run" }); assert.equal(r.status, 200); assert.equal(notice.status, "succeeded");
assert.equal(mailAttempts.length, 2); assert.equal(mailAttempts[0].key, mailAttempts[1].key); assert.deepEqual(mailAttempts[0].body, mailAttempts[1].body); assert.equal(notice.delivery_status, "delivered");
r = await call({ action: "run" }); assert.equal(r.status, 200); assert.equal(mailAttempts.length, 2);
settings.mailPaused = true;
console.log("SEO compiled routes: real catalogue, graph/queries, anonymous/forged admin denial, private cache, GET immutability, CSRF, validation, absent provider, explicit publication confirmation and cron protection passed. Resend failure/retry preserved the payload and idempotency key, recipient isolation, delivery reconciliation and duplicate prevention passed with fixtures. No network or real email.");
if (process.argv.includes("--serve")) {
  const { createServer } = await import("node:http"), { readFile } = await import("node:fs/promises"), { resolve, sep, extname } = await import("node:path");
  const root = resolve(".vercel/output/static"), mime = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
  createServer(async (req, res) => { try { const u = new URL(req.url, "http://127.0.0.1:4343");
    if (u.pathname.startsWith("/_astro/")) { const path = resolve(root, "." + decodeURIComponent(u.pathname)); assert.ok(path.startsWith(root + sep)); res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream" }); res.end(await readFile(path)); return; }
    if (!["/admin/seo", "/api/admin/seo"].includes(u.pathname)) { res.writeHead(404); res.end(); return; }
    const parts = []; for await (const chunk of req) parts.push(chunk);
    const headers = new Headers(req.headers); headers.set("cookie", cookie); headers.delete("host"); if (req.method === "POST") headers.set("origin", "https://imperioes.com");
    const response = await app.fetch(new Request("https://imperioes.com" + u.pathname + u.search, { method: req.method, headers, ...(parts.length ? { body: Buffer.concat(parts) } : {}) }));
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end("Isolated SEO fixture failed"); } }).listen(4343, "127.0.0.1", () => console.log("Isolated SEO panel: http://127.0.0.1:4343/admin/seo. No production writes or sends."));
}
