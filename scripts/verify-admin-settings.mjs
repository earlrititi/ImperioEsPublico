import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { Socket } from "node:net";

Socket.prototype.connect = () => { throw Error("External connections disabled in settings fixtures"); };
const env = parseEnv(readFileSync(".env.local", "utf8"));
Object.assign(process.env, { PUBLIC_SITE_URL:"https://imperioes.com", PUBLIC_SUPABASE_URL:env.PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY:"fixture-anon", SUPABASE_SERVICE_ROLE_KEY:"fixture-service",
  STRIPE_SECRET_KEY:"sk_live_fixture-never-render", RESEND_API_KEY:"re_fixture-never-render",
  GA4_SERVICE_ACCOUNT_JSON:"private-fixture-never-render", STRIPE_LIVE_CHECKOUT_ENABLED:"true", SHIRT_SALES_APPROVED:"true", RESERVATION_MODE:"false" });
const user = { id:"24f42701-98e0-4716-810c-363ae1cc8fa2", email:"fixture@example.invalid", email_confirmed_at:"2026-10-01T00:00:00Z",
  aud:"authenticated", role:"authenticated", app_metadata:{}, user_metadata:{} };
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const expires = Math.floor(Date.now()/1000)+3600;
const token = `${encode({alg:"HS256",typ:"JWT"})}.${encode({sub:user.id,exp:expires,role:"authenticated"})}.fixture`;
const project = new URL(env.PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookie = `sb-${project}-auth-token=base64-${encode({access_token:token,refresh_token:"fixture-refresh",token_type:"bearer",expires_at:expires,expires_in:3600,user})}`;
let forged = false;
globalThis.fetch = async input => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.pathname === "/auth/v1/user") return Response.json(forged ? {...user,id:"00000000-0000-4000-8000-000000000001",user_metadata:{role:"admin"}} : user);
  throw Error(`Unexpected settings fixture request: ${url.pathname}`);
};
const {default:app} = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const get = authenticated => app.fetch(new Request("https://imperioes.com/admin/configuracion",{headers:authenticated?{cookie}:{}}));
assert.equal((await get(false)).status,302);
forged=true; assert.equal((await get(true)).status,302); forged=false;
const response=await get(true), body=await response.text();
assert.equal(response.status,200);
assert.match(response.headers.get("cache-control"),/private, no-store/);
for (const text of ["Configuracion","Comercio","Correo","Google Tag Manager","IONOS"]) assert.ok(body.includes(text));
assert.doesNotMatch(body,/fixture-never-render|fixture-service|fixture-refresh|GA4_SERVICE_ACCOUNT_JSON|STRIPE_SECRET_KEY|RESEND_API_KEY/);
assert.doesNotMatch(body,/<form[^>]+action="\/api\/admin\//);
console.log("Admin settings: confirmed administrator only, forged-role refusal, private caching, read-only configuration and no secret output passed. No real services.");
