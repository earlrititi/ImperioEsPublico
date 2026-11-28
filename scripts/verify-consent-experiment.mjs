import assert from "node:assert/strict";
import { Socket } from "node:net";

Socket.prototype.connect = () => { throw Error("No network in consent experiment fixtures"); };
globalThis.fetch = async () => { throw Error("No external services in consent experiment fixtures"); };
process.env.CONSENT_EXPERIMENT_PREVIEW = "true";
process.env.VERCEL_ENV = "preview";

const { default: app } = await import("../.vercel/output/functions/_render.func/dist/server/entry.mjs");
const origin = "https://imperio-consent-fixture.vercel.app";
const path = "/api/legal-consent?experiment=1";
const request = (url, options) => app.fetch(new Request(url, options));
const post = (payload, requestOrigin = origin) => request(origin + path, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: requestOrigin },
  body: JSON.stringify(payload),
});

const preview = await request(origin + "/legal/cookies");
assert.equal(preview.status, 200);
assert.match(await preview.text(), /data-experiment-check/);
assert.deepEqual(await (await request(origin + path)).json(), { decision: null });
assert.equal((await post({ decision: "accepted" }, "https://other.invalid")).status, 403);
assert.equal((await post({ decision: "accepted", email: "fixture@example.invalid" })).status, 400);
assert.equal((await request(origin + "/api/legal-consent", { method: "POST" })).status, 404);

for (const decision of ["accepted", "rejected"]) {
  const response = await post({ decision });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { decision });
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /^imperio_consent_experiment_v1=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Secure/i);
  const next = await request(origin + path, { headers: { Cookie: cookie.split(";")[0] } });
  assert.deepEqual(await next.json(), { decision });
}

assert.equal((await request("https://imperioes.com" + path)).status, 404);
process.env.VERCEL_ENV = "production";
assert.equal((await request(origin + path)).status, 404);
assert.equal((await post({ decision: "accepted" })).status, 404);
const production = await request("https://imperioes.com/legal/cookies");
assert.equal(production.status, 200);
assert.doesNotMatch(await production.text(), /data-experiment-check(?:\s|>)/);

console.log("Consent experiment SSR, isolation, cookie persistence and production guard passed.");
