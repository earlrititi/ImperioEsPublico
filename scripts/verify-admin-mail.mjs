import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { Socket } from "node:net";

Socket.prototype.connect = () => { throw new Error("No real network allowed in mail fixtures"); };
Object.assign(process.env, {
  COMMERCE_EMAIL_MODE: "live", RESEND_API_KEY: "re_fixture",
  RESERVATION_TOKEN_SECRET: "fixture", PUBLIC_SITE_URL: "https://imperioes.com",
  PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fixture",
});
const id = "11111111-1111-4111-8111-111111111111";
const job = { id, reservation_id: id, claim_id: id, kind: "RESERVED", encrypted_message: null, status: "PROCESSING" };
const reservation = {
  id, request_id: id, number: "RES-FIXTURE", status: "RESERVED",
  customer_name: "Cliente de prueba", customer_email: "fixture@example.invalid",
  shipping_address: { name: "Cliente de prueba", line1: "Calle Prueba 12", city: "Madrid", postalCode: "28001", province: "28" },
  total_price_snapshot: 8997,
  reservation_items: [{ product_name: "Camiseta", sku: "IE-M", size: "M", color: "Negro", quantity: 3, unit_price_snapshot: 2999, line_total_snapshot: 8997 }],
};
let failAdmin = true;
const sends = [];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (input, options) => {
  const req = input instanceof Request ? input : new Request(input, options);
  const url = new URL(req.url);
  const body = req.method === "GET" ? null : await req.json();
  if (url.pathname === "/rest/v1/rpc/claim_commerce_mail") return json(job.status === "SENT" ? [] : [{ ...job }]);
  if (url.pathname === "/rest/v1/reservations") return json(reservation);
  if (url.pathname === "/rest/v1/commerce_outbox" && req.method === "PATCH") {
    Object.assign(job, body);
    return json([{ id }]);
  }
  if (url.hostname === "api.resend.com" && url.pathname === "/emails") {
    sends.push({ body, key: req.headers.get("idempotency-key") });
    if (body.to.includes("earlrititi@gmail.com") && failAdmin) return json({ name: "application_error", message: "fixture failure" }, 500);
    return json({ id: "email_fixture" });
  }
  throw new Error(`Unexpected fixture request ${req.method} ${url.pathname}`);
};
const directory = new URL("../.vercel/output/functions/_render.func/dist/server/chunks/", import.meta.url);
const filename = readdirSync(directory).find(name => name.startsWith("commerce-mail_") && name.endsWith(".mjs"));
assert.ok(filename);
const module = await import(new URL(filename, directory).href);
const drain = Object.values(module).find(value => typeof value === "function" && value.name === "drainCommerceMail");
assert.ok(drain);
assert.equal((await drain(1)).sent, 0);
assert.equal(job.status, "PROCESSING");
assert.ok(job.encrypted_message);
failAdmin = false;
assert.equal((await drain(1)).sent, 1);
assert.equal(job.status, "SENT");
assert.equal(sends.length, 4);
assert.deepEqual(sends[0], sends[2], "Customer retry preserves the same payload and idempotency key");
assert.deepEqual(sends[1], sends[3], "Admin retry preserves the same payload and idempotency key");
assert.match(sends[1].body.text, /Cantidad de camisetas: 3/);
assert.doesNotMatch(sends[1].body.text, /https?:|token=/);
assert.equal(sends[0].body.adminNotification, undefined);
assert.equal((await drain(1)).sent, 0);
job.status = "PROCESSING";
job.encrypted_message = null;
process.env.COMMERCE_EMAIL_MODE = "test";
process.env.COMMERCE_TEST_EMAIL = "sink@example.invalid";
assert.equal((await drain(1)).sent, 1);
assert.ok(sends.slice(-2).every(send => send.body.to.includes("sink@example.invalid")));
console.log("Admin reservation mail: snapshots, retries, recipient isolation and private-link exclusion passed. No real emails.");
