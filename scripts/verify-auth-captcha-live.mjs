import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// A one-use browser challenge arrives on stdin, never through arguments or logs.
assert.equal(process.argv[2], "--production", "Explicit production opt-in required");
assert.ok(process.argv[3], "Provide an existing environment file with the public Auth configuration");
const config = parseEnv(readFileSync(process.argv[3], "utf8"));
const authOrigin = "https://pjrqozlyrjgugdraoght.supabase.co";
assert.equal(config.PUBLIC_SUPABASE_URL?.replace(/\/$/, ""), authOrigin);
assert.ok(config.PUBLIC_SUPABASE_ANON_KEY, "Public Auth key required");
const token = readFileSync(0, "utf8").trim();
assert.ok(token.length > 0 && token.length <= 2048, "Fresh challenge required on stdin");
assert.notEqual(token, "XXXX.DUMMY.TOKEN.XXXX", "Do not use a dummy challenge in production");
const email = `captcha-probe-${randomUUID()}@example.invalid`;
const password = `${randomUUID()}-invalid-only`;
const results = [];

async function authProbe(name, responseToken, expectedCode) {
  const response = await fetch(`${authOrigin}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.PUBLIC_SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password, ...(responseToken === undefined ? {} : {
      gotrue_meta_security: { captcha_token: responseToken },
    }) }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  const code = data.error_code ?? data.code ?? data.error;
  assert.ok(!response.ok, `${name}: no session may be created by this probe`);
  assert.equal(code, expectedCode, `${name}: unexpected Auth result`);
  results.push({ name, status: response.status, code });
}

await authProbe("native-missing-token", undefined, "captcha_failed");
await authProbe("native-forged-token", "invalid-captcha-probe", "captcha_failed");
// Invalid credentials here mean CAPTCHA passed; no real account is used.
await authProbe("native-fresh-token", token, "invalid_credentials");
await authProbe("native-replay", token, "captcha_failed");

for (const origin of ["https://imperioes.com", "https://www.imperioes.com"]) {
  const response = await fetch(`${origin}/login`, {
    method: "POST", redirect: "manual",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  const location = new URL(response.headers.get("location"), origin);
  assert.equal(response.status, 303);
  assert.equal(location.searchParams.get("error"), "captcha");
  results.push({ name: `${new URL(origin).hostname}-missing-token`, status: response.status, code: "captcha" });
}
console.log(JSON.stringify({ passed: results, accountsCreated: 0, emailsSent: 0, payments: 0 }));
