import assert from "node:assert/strict";
import { Socket } from "node:net";
import tls from "node:tls";

// Test the compiled contact endpoint without a database, transport or real email.
const blocked = () => { throw Error("Real network prohibited in contact fixtures"); };
Socket.prototype.connect = blocked;
tls.connect = blocked;
Object.assign(process.env, {
  PUBLIC_SITE_URL: "https://imperioes.com",
  PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  PUBLIC_SUPABASE_ANON_KEY: "fixture-anon",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
  RATE_LIMIT_SECRET: "fixture-rate",
  RESEND_API_KEY: "re_fixture",
  TRANSACTIONAL_EMAIL_TEST_RECIPIENT: "",
});
const messages = [];
let allowed = true;
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit") return Response.json(allowed);
  if (url.hostname === "api.resend.com" && url.pathname === "/emails" && request.method === "POST") {
    messages.push(await request.json());
    return Response.json({ id: `fixture-contact-${messages.length}` });
  }
  throw Error(`Unexpected contact fixture request: ${request.method} ${url.pathname}`);
};
const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const payload = { firstName: "Contacto", lastName: "Prueba", email: "reader@example.invalid", subject: "Consulta fixture", message: "Mensaje solicitado de prueba" };
const contact = (body = payload, origin = "https://imperioes.com", extra = {}) => app.fetch(new Request("https://imperioes.com/api/contact", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json", ...extra },
  body: JSON.stringify(body),
}));

assert.equal((await contact()).status, 200, "Contact does not require a fictitious privacy checkbox");
assert.equal(messages.length, 1, "Only the requested contact notification is sent");
assert.equal(messages[0].to, "contacto@imperioes.com");
assert.equal(messages[0].reply_to, payload.email);
assert.match(messages[0].html, /data-imperio-email-layout="pergamino-v1"/);
assert.doesNotMatch(messages[0].html, /marketing_email|welcome_[1-5]/);
assert.equal((await contact(payload, "https://untrusted.invalid")).status, 403);
// Keep the existing shared helper's compatibility for clients without Origin.
assert.equal((await contact(payload, "")).status, 200);
assert.equal(messages.length, 2);
const before = messages.length;
assert.equal((await contact({ ...payload, email: "invalid" })).status, 400);
assert.equal((await contact({ ...payload, firstName: "", lastName: "" })).status, 400);
assert.equal((await contact({ ...payload, subject: "" })).status, 400);
assert.equal((await contact({ ...payload, message: "" })).status, 400);
assert.equal((await contact({ ...payload, company: "trap" })).status, 200);
assert.equal((await contact(payload, "https://imperioes.com", { "Content-Length": "32769" })).status, 413);
allowed = false;
assert.equal((await contact()).status, 429);
assert.equal(messages.length, before, "Invalid, honeypot and rate-limited requests cannot send or enroll marketing");
console.log("Compiled contact: no privacy checkbox, corporate renderer, no commercial enrollment, input validation, origin, honeypot, size and rate-limit checks passed. Fixtures only; no real email or network.");
