import assert from "node:assert/strict";
import { Socket } from "node:net";

// Exercise the compiled endpoint with synthetic services; no customer records,
// financial updates, provider messages, or real network calls are permitted.
Socket.prototype.connect = () => { throw Error("Real network disabled in admin shirt pricing fixtures"); };
Object.assign(process.env, {
  PUBLIC_SITE_URL: "https://imperioes.com", PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", COMMERCE_EMAIL_MODE: "disabled",
});
const admin = {
  id: "24f42701-98e0-4716-810c-363ae1cc8fa2", email: "fixture@example.invalid", email_confirmed_at: "2026-10-01T00:00:00Z",
  aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {},
};
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const expires = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: admin.id, exp: expires, role: "authenticated" })}.fixture`;
const cookie = `sb-fixture-auth-token=base64-${encode({ access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: expires, expires_in: 3600, user: admin })}`;
const reservationId = "00000000-0000-4000-8000-000000000001";
const orderId = "00000000-0000-4000-8000-000000000002";
const outsideId = "00000000-0000-4000-8000-000000000003";
const pendingId = "00000000-0000-4000-8000-000000000004";
const projection = "id,reservation_id,number,status,currency,total_quantity,product_subtotal,shipping_amount,shipping_method,discount_amount,subtotal,total,refunded_amount,commerce_order_items(id,sku,size,quantity,unit_price,line_total,currency)";
const paidStatuses = ["PAID", "READY_FOR_FULFILLMENT", "PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "REFUNDED"];
const converted = { id: reservationId, status: "CONVERTED_TO_ORDER", order_id: orderId, total_price_snapshot: 2999 };
const pending = { id: pendingId, status: "PAYMENT_PENDING", order_id: outsideId, total_price_snapshot: 2999 };
const paidOrder = {
  id: orderId, reservation_id: reservationId, number: "PED-fixture", status: "READY_FOR_FULFILLMENT", currency: "eur",
  total_quantity: 1, product_subtotal: 2699, shipping_amount: 0, shipping_method: "standard", discount_amount: 400,
  subtotal: 2699, total: 2299, refunded_amount: 0,
  commerce_order_items: [{ id: outsideId, sku: "IE-CAMISETA-IMPERIAL-XXL", size: "XXL", quantity: 1, unit_price: 2699, line_total: 2699, currency: "eur" }],
};
let forged = false, reads = 0, orderReads = 0, reservationRows = [converted, pending], returnedOrders = [paidOrder];
const json = value => Response.json(value, { headers: { "Content-Range": "0-1/2" } });
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init), url = new URL(request.url);
  if (url.pathname === "/auth/v1/user" && request.method === "GET")
    return json(forged ? { ...admin, id: outsideId, user_metadata: { role: "admin" } } : admin);
  reads++;
  if (url.pathname === "/rest/v1/rpc/commerce_summary" && request.method === "POST") return json({ paidOrders: 1 });
  assert.ok(["GET", "HEAD"].includes(request.method), `Unexpected mutation ${request.method} ${url.pathname}`);
  if (url.pathname === "/rest/v1/product_variants") return json([]);
  if (url.pathname === "/rest/v1/reservations") return json(request.method === "HEAD" ? [] : reservationRows);
  if (url.pathname === "/rest/v1/commerce_campaign") return json({ id: "shirt-first-edition" });
  if (url.pathname === "/rest/v1/commerce_orders") {
    orderReads++;
    assert.equal(request.method, "GET");
    assert.equal(url.searchParams.get("select"), projection);
    assert.equal(url.searchParams.get("id"), `in.(${orderId})`, "Only linked converted orders on the current page may be read");
    assert.equal(url.searchParams.get("status"), `in.(${paidStatuses.join(",")})`);
    return json(returnedOrders);
  }
  throw Error(`Unexpected fixture ${request.method} ${url.pathname}`);
};

const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const get = (path = "?view=reservations", authenticated = true) => app.fetch(new Request(`https://imperioes.com/api/commerce-admin${path}`, { headers: authenticated ? { cookie } : {} }));
assert.equal((await get("?view=reservations", false)).status, 403);
forged = true; assert.equal((await get()).status, 403); forged = false;
assert.equal(reads, 0, "Anonymous and forged-role callers cannot read commerce data");

const original = structuredClone({ reservationRows, returnedOrders });
let response = await get();
assert.equal(response.status, 200);
assert.match(response.headers.get("cache-control"), /no-store/);
let body = await response.json();
assert.equal(body.rows[0].total_price_snapshot, 2999, "The original quote must remain intact");
assert.equal(body.rows[0].paidOrder.total, 2299, "The actual linked payment is available separately");
assert.equal(body.rows[0].paidOrder.commerce_order_items[0].unit_price, 2699, "The original unit price is not rewritten");
assert.equal(body.rows[1].paidOrder, null, "A pending reservation is not presented as a sale");
assert.deepEqual({ reservationRows, returnedOrders }, original);
assert.equal(orderReads, 1);
assert.doesNotMatch(JSON.stringify(body), /fixture-service|fixture-refresh|actor_id/);

// A source returning an unrelated ID, a wrong reservation, or an unpaid order
// must not attach those amounts to this reservation.
for (const unrelated of [
  { ...paidOrder, id: outsideId },
  { ...paidOrder, reservation_id: outsideId },
  { ...paidOrder, status: "PAYMENT_PENDING" },
]) {
  returnedOrders = [unrelated];
  response = await get(); assert.equal(response.status, 200);
  body = await response.json(); assert.equal(body.rows[0].paidOrder, null);
  assert.equal(body.rows[0].total_price_snapshot, 2999);
}
returnedOrders = [{ ...paidOrder, status: "REFUNDED", refunded_amount: 2299 }];
response = await get(); assert.equal(response.status, 200);
body = await response.json();
assert.equal(body.rows[0].paidOrder.total, 2299, "Refunds retain the original sale total");
assert.equal(body.rows[0].paidOrder.refunded_amount, 2299);

const beforeNoLinks = orderReads;
for (const rows of [[], [pending], [{ ...converted, order_id: null }]]) {
  reservationRows = rows;
  response = await get(); assert.equal(response.status, 200);
  body = await response.json();
  assert.ok(body.rows.every(row => row.paidOrder === null));
}
assert.equal(orderReads, beforeNoLinks, "Missing, empty, and unpaid links must not perform an unscoped read");
reservationRows = [{ ...converted, order_id: "invalid-link" }];
assert.equal((await get()).status, 503);
assert.equal(orderReads, beforeNoLinks, "Invalid IDs fail before an order lookup");
reservationRows = [{ ...converted, status: "WAITLIST" }];
assert.equal((await get("?view=waitlist")).status, 200);
assert.equal(orderReads, beforeNoLinks, "Waitlist views do not query payments");
console.log("Admin shirt pricing: protected compiled API, exact page-scoped paid-order joins, unchanged quotes and item snapshots, excluded unpaid/unrelated records, refunds preserved, private caching and no writes or messages passed. Synthetic services only.");
