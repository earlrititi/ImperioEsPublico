import test from "node:test";
import assert from "node:assert/strict";
import type { AstroCookies } from "astro";
import { AUTH_ANALYTICS_COOKIE, recordAuthAnalytics, consumeAuthAnalytics } from "../src/lib/auth-analytics";
import { CONSENT_KEY } from "../src/lib/cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";

function fixture(analytics = true, path = "/login", version = LEGAL_DOCUMENT_VERSIONS.cookies as string) {
  const consent = { version, analytics, marketing: false, preferences: false, updatedAt: new Date(Date.now() - 1000).toISOString() };
  const values = new Map([[CONSENT_KEY, JSON.stringify(consent)]]);
  const settings: Record<string, unknown>[] = [];
  const cookies = {
    get: (name: string) => values.has(name) ? { value: values.get(name)! } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => { values.set(name, value); settings.push(options); },
    delete: (name: string) => values.delete(name),
  } as unknown as AstroCookies;
  return { consent, values, settings, context: { cookies, request: new Request(`https://imperioes.com${path}`) } };
}

test("auth analytics requires a current opt-in, signs minimal evidence and consumes it only on public pages", () => {
  const previous = process.env.RATE_LIMIT_SECRET;
  process.env.RATE_LIMIT_SECRET = "fixture-only-auth-analytics-secret";
  try {
    for (const f of [fixture(false), fixture(true, "/login", "old")]) {
      recordAuthAnalytics(f.context, "login", "password");
      assert.equal(f.values.has(AUTH_ANALYTICS_COOKIE), false);
    }
    const f = fixture();
    recordAuthAnalytics(f.context, "login", "password");
    assert.equal(f.settings[0].httpOnly, true);
    assert.equal(f.settings[0].secure, true);
    assert.equal(f.settings[0].maxAge, 300);
    assert.equal(f.settings[0].domain, "imperioes.com");
    const raw = f.values.get(AUTH_ANALYTICS_COOKIE)!;
    const payload = JSON.parse(Buffer.from(raw.split(".")[0], "base64url").toString());
    assert.deepEqual(Object.keys(payload).sort(), ["at", "consentAt", "event", "method"]);
    assert.equal(consumeAuthAnalytics(f.context), null);
    assert.equal(f.values.has(AUTH_ANALYTICS_COOKIE), true, "A private page must not consume or measure the action");
    f.context.request = new Request("https://www.imperioes.com/tienda");
    const action = consumeAuthAnalytics(f.context)!;
    assert.equal(action.event, "login");
    assert.match(action.id, /^[a-f0-9]{64}$/);
    assert.equal(action.expiresAt, payload.at + 300000);
    assert.equal(f.values.has(AUTH_ANALYTICS_COOKIE), false);
    assert.equal(consumeAuthAnalytics(f.context), null);
  } finally { if (previous === undefined) delete process.env.RATE_LIMIT_SECRET; else process.env.RATE_LIMIT_SECRET = previous; }
});

test("auth receipts reject tampering, expiry, withdrawal and a later consent without affecting authentication", () => {
  const previous = process.env.RATE_LIMIT_SECRET;
  process.env.RATE_LIMIT_SECRET = "fixture-only-auth-analytics-secret";
  try {
    for (const scenario of ["tamper", "expiry", "withdrawal", "changed", "oversized"]) {
      const f = fixture();
      recordAuthAnalytics(f.context, "sign_up", "password");
      const raw = f.values.get(AUTH_ANALYTICS_COOKIE)!;
      if (scenario === "tamper") f.values.set(AUTH_ANALYTICS_COOKIE, `${raw.split(".")[0]}.invalid`);
      if (scenario === "oversized") f.values.set(AUTH_ANALYTICS_COOKIE, "a".repeat(1000));
      if (scenario === "withdrawal") f.values.set(CONSENT_KEY, JSON.stringify({ ...f.consent, analytics: false }));
      if (scenario === "changed") f.values.set(CONSENT_KEY, JSON.stringify({ ...f.consent, updatedAt: new Date().toISOString() }));
      f.context.request = new Request("https://imperioes.com/tienda");
      assert.equal(consumeAuthAnalytics(f.context, Date.now() + (scenario === "expiry" ? 300001 : 0)), null, scenario);
      assert.equal(f.values.has(AUTH_ANALYTICS_COOKIE), false);
    }
    delete process.env.RATE_LIMIT_SECRET;
    assert.doesNotThrow(() => recordAuthAnalytics(fixture().context, "login", "password"));
  } finally { if (previous === undefined) delete process.env.RATE_LIMIT_SECRET; else process.env.RATE_LIMIT_SECRET = previous; }
});
