import assert from "node:assert/strict";
import { Socket } from "node:net";
Socket.prototype.connect = () => { throw Error("Real network disabled in owner shipment fixtures"); };
Object.assign(process.env, { PUBLIC_SITE_URL: "https://imperioes.com", PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", COMMERCE_EMAIL_MODE: "disabled" });
const admin = { id: "24f42701-98e0-4716-810c-363ae1cc8fa2", email: "fixture@example.invalid", email_confirmed_at: "2026-10-01T00:00:00Z",
  aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const expires = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: admin.id, exp: expires, role: "authenticated" })}.fixture`;
const cookie = `sb-fixture-auth-token=base64-${encode({ access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: expires, expires_in: 3600, user: admin })}`;
const own = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002";
const action = "shipment:owner_declared:correos_ordinario:untracked:dispatch_date_unknown:declared_on=2026-11-21";
let forged = false, auditReads = 0, noRows = false;
const json = value => Response.json(value, { headers: { "Content-Range": "0-0/1" } });
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
  if (url.pathname === "/auth/v1/user" && request.method === "GET") return json(forged ? { ...admin, id: other, user_metadata: { role: "admin" } } : admin);
  if (url.pathname === "/rest/v1/rpc/commerce_summary" && request.method === "POST") return json({ paidOrders: 1 });
  assert.ok(["GET", "HEAD"].includes(request.method), `Unexpected mutation ${request.method} ${url.pathname}`);
  if (url.pathname === "/rest/v1/product_variants") return json([]);
  if (url.pathname === "/rest/v1/reservations") return json([]);
  if (url.pathname === "/rest/v1/commerce_orders") return json(noRows ? [] : [{ id: own, number: "PED-fixture", status: "READY_FOR_FULFILLMENT", total: 2999, shipped_at: null, carrier_delivered_at: null, customer_received_at: null }]);
  if (url.pathname === "/rest/v1/commerce_campaign") return json({ id: "shirt-first-edition" });
  if (url.pathname === "/rest/v1/commerce_audit") {
    auditReads++;
    assert.equal(url.searchParams.get("action"), `eq.${action}`);
    assert.equal(url.searchParams.get("entity_id"), `in.(${own})`);
    assert.equal(url.searchParams.get("select"), "entity_id,action,created_at");
    // Defensive response scoping remains effective if the backing source returns an unrelated row.
    return json([{ entity_id: own, action, created_at: "2026-11-21T11:07:58Z" }, { entity_id: other, action, created_at: "2026-11-21T11:07:58Z" }]);
  }
  throw Error(`Unexpected fixture ${request.method} ${url.pathname}`);
};
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const get = (path, authenticated = true) => app.fetch(new Request(`https://imperioes.com/api/commerce-admin${path}`, { headers: authenticated ? { cookie } : {} }));
assert.equal((await get("?view=orders", false)).status, 403);
forged = true; assert.equal((await get("?view=orders")).status, 403); forged = false;
assert.equal(auditReads, 0, "Unauthenticated callers cannot read audit notes");
const response = await get("?view=orders");
assert.equal(response.status, 200);
assert.match(response.headers.get("cache-control"), /no-store/);
const body = await response.json();
assert.equal(body.rows.length, 1);
assert.equal(body.rows[0].status, "READY_FOR_FULFILLMENT");
assert.equal(body.rows[0].shipped_at, null);
assert.equal(body.rows[0].customer_received_at, null);
assert.deepEqual(body.rows[0].ownerShipmentDeclaration, { declaredOn: "2026-11-21", recordedAt: "2026-11-21T11:07:58.000Z" });
assert.doesNotMatch(JSON.stringify(body), /actor_id|shipment:owner_declared|fixture-service|fixture-refresh/);
assert.equal(auditReads, 1);
assert.equal((await get("?view=reservations")).status, 200);
assert.equal(auditReads, 1, "Reservation views do not read order audit notes");
noRows = true; assert.equal((await get("?view=orders&page=999")).status, 200);
assert.equal(auditReads, 1, "Empty order pages do not perform an unrestricted audit read");
console.log("Owner dispatch: admin-only API, forged-role refusal, paginated audit scope, private caching, no invented dispatch/receipt, no writes or messages passed. Synthetic services only.");
