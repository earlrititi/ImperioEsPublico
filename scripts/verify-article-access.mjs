import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Exercise the actual compiled route, with no requests to real users or services.
const local = parseEnv(fs.readFileSync(".env.local", "utf8"));
const project = new URL(local.PUBLIC_SUPABASE_URL).hostname.split(".")[0];
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-role";
process.env.PUBLIC_SUPABASE_URL = local.PUBLIC_SUPABASE_URL;
process.env.PUBLIC_SUPABASE_ANON_KEY = "fixture-anon";
const userId = "00000000-0000-4000-8000-000000000001";
const expires = Math.floor(Date.now() / 1000) + 3600;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp: expires, role: "authenticated" })}.fixture`;
const cookie = `sb-${project}-auth-token=base64-${encode({
  access_token: token, refresh_token: "fixture", token_type: "bearer",
  expires_at: expires, expires_in: 3600,
  user: { id: userId, email: "fixture@example.invalid" },
})}`;
let subscription = null;
let appMetadata = {};
let userMetadata = {};
let confirmedAt = "2026-09-15T00:00:00Z";
let unavailable = false;
let calls = 0;
globalThis.fetch = async (input, options) => {
  calls++;
  if (unavailable) return new Response(JSON.stringify({ message: "fixture unavailable" }), { status: 503 });
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  let data;
  if (url.pathname === "/auth/v1/user") {
    data = { id: userId, email: "fixture@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: appMetadata, user_metadata: userMetadata, email_confirmed_at: confirmedAt };
  } else if (url.pathname === "/rest/v1/profiles") {
    data = { email: "fixture@example.invalid" };
  } else if (url.pathname === "/rest/v1/subscriptions") {
    const headers = new Headers(options?.headers ?? (input instanceof Request ? input.headers : undefined));
    data = headers.get("accept")?.includes("vnd.pgrst.object") ? subscription : (subscription ? [subscription] : []);
  } else {
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  }
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};

const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const premiumPath = "/papeles-y-tratados/cruz-de-borgona-historia";
const marker = "Un martirio convertido en emblema";
let cases = 0;
async function check(label, pathname, authenticated, accessible, status = 200) {
  const response = await app.fetch(new Request(`https://imperioes.com${pathname}`, {
    headers: authenticated ? { cookie } : {},
  }));
  const html = await response.text();
  assert.equal(response.status, status, label);
  if (pathname === premiumPath) {
    assert.equal(html.includes(marker), accessible, `${label}: body disclosure`);
    assert.equal(response.headers.get("cache-control"), "private, no-store", label);
    assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store", label);
  } else if (status === 200) {
    assert.ok(html.includes("article-page__copy") && !html.includes("Articulo para suscriptores"), label);
  }
  cases++;
}

await check("anonymous premium", premiumPath, false, false);
assert.equal(calls, 0, "Anonymous access should not need a network request");
for (const plan of ["piquero", "arcabucero", "maestre_campo"]) {
  for (const billing_interval of ["month", "year"]) {
    for (const status of ["active", "trialing", "canceled", "past_due", "unpaid"]) {
      subscription = { id: "fixture", user_id: userId, plan, billing_interval, status, cancel_at_period_end: false };
      await check(`${plan}/${billing_interval}/${status}`, premiumPath, true,
        plan !== "piquero" && ["active", "trialing"].includes(status));
    }
  }
}
subscription = { id: "fixture", user_id: userId, plan: "arcabucero", status: "active", cancel_at_period_end: true };
await check("cancel at period end retains paid access", premiumPath, true, true);
subscription = null;
appMetadata = { editorial_admin: true };
await check("editorial administrator without subscription", premiumPath, true, true);
confirmedAt = null;
await check("unverified editorial account denied", premiumPath, true, false);
confirmedAt = "2026-09-15T00:00:00Z";
appMetadata = {};
userMetadata = { editorial_admin: true };
await check("user editable metadata cannot grant editorial access", premiumPath, true, false);
userMetadata = {};
unavailable = true;
await check("subscription service failure", premiumPath, true, false, 503);
await check("free article during service failure", "/papeles-y-tratados/el-imperio-donde-nunca-se-pone-el-sol", false, true);
await check("unknown article", "/papeles-y-tratados/not-a-real-article", false, false, 404);

for (const slug of ["12-de-octubre-dia-de-la-hispanidad", "cruz-de-borgona-historia"]) {
  const response = await app.fetch(new Request(`https://imperioes.com/articulos/${slug}?from=legacy`));
  assert.equal(response.status, 301);
  assert.equal(response.headers.get("location"), `/papeles-y-tratados/${slug}?from=legacy`);
  cases++;
}

const staticRoot = ".vercel/output/static";
assert.equal(fs.existsSync(path.join(staticRoot, "images/articulos/textos")), false);
assert.equal(fs.existsSync(path.join(staticRoot, premiumPath, "index.html")), false);
let inspected = 0;
const sourceMarkers = fs.readdirSync("src/data/article-texts")
  .filter(name => name.endsWith(".txt"))
  .map(name => fs.readFileSync(path.join("src/data/article-texts", name), "utf8")
    .split(/\r?\n/).find(line => /^[\p{L}]/u.test(line) && line.length > 250)?.slice(0, 160))
  .filter(Boolean);
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(filename);
    else if (/\.(?:html|m?js|cjs|json|txt|map|xml)$/.test(entry.name)) {
      const contents = fs.readFileSync(filename, "utf8");
      for (const bodyMarker of [marker, ...sourceMarkers]) {
        assert.equal(contents.includes(bodyMarker), false, `Public body leak: ${filename}`);
        assert.equal(contents.includes(JSON.stringify(bodyMarker).slice(1, -1)), false, `Public raw body leak: ${filename}`);
      }
      inspected++;
    }
  }
}
scan(staticRoot);
console.log(`${cases} compiled-route access scenarios passed; ${inspected} public artifacts inspected. No live services contacted.`);
