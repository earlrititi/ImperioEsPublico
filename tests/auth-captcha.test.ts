import test from "node:test";
import assert from "node:assert/strict";
import { authCaptchaConfig, authCaptchaToken, isAuthCaptchaFailure } from "../src/lib/auth-captcha";
import { readFileSync } from "node:fs";

test("Auth CAPTCHA is opt-in and fails closed if enabled without a valid token or configuration", () => {
  const before = { enabled: process.env.AUTH_CAPTCHA_ENABLED, key: process.env.PUBLIC_TURNSTILE_SITE_KEY };
  try {
    delete process.env.AUTH_CAPTCHA_ENABLED;
    delete process.env.PUBLIC_TURNSTILE_SITE_KEY;
    assert.deepEqual(authCaptchaConfig(), { enabled: false, siteKey: "" });
    assert.equal(authCaptchaToken(new URLSearchParams()), undefined);
    process.env.AUTH_CAPTCHA_ENABLED = "true";
    assert.throws(() => authCaptchaToken(new URLSearchParams({ "cf-turnstile-response": "token" })), /captcha/);
    process.env.PUBLIC_TURNSTILE_SITE_KEY = "fixture-sitekey";
    for (const form of [new URLSearchParams(), new URLSearchParams({ "cf-turnstile-response": " " }),
      new URLSearchParams({ "cf-turnstile-response": "x".repeat(2049) }),
      new URLSearchParams([["cf-turnstile-response", "one"], ["cf-turnstile-response", "two"]])]) {
      assert.throws(() => authCaptchaToken(form), /captcha/);
    }
    assert.equal(authCaptchaToken(new URLSearchParams({ "cf-turnstile-response": "fixture-token" })), "fixture-token");
    assert.equal(isAuthCaptchaFailure({ code: "captcha_failed" }), true);
    assert.equal(isAuthCaptchaFailure({ code: "invalid_credentials" }), false);
    assert.equal(isAuthCaptchaFailure(null), false);
  } finally {
    if (before.enabled === undefined) delete process.env.AUTH_CAPTCHA_ENABLED; else process.env.AUTH_CAPTCHA_ENABLED = before.enabled;
    if (before.key === undefined) delete process.env.PUBLIC_TURNSTILE_SITE_KEY; else process.env.PUBLIC_TURNSTILE_SITE_KEY = before.key;
  }
});

test("CSP permits only the explicit Turnstile script/frame origin without removing protections", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const policy = config.headers[0].headers.find((header: { key: string }) => header.key === "Content-Security-Policy").value;
  const directives = new Map<string, string>(policy.split(";").map((value: string) => {
    const [name, ...sources] = value.trim().split(/\s+/);
    return [name, sources.join(" ")];
  }));
  assert.ok(directives.get("script-src")?.includes("https://challenges.cloudflare.com"));
  assert.ok(directives.get("frame-src")?.includes("https://challenges.cloudflare.com"));
  assert.equal(directives.get("frame-ancestors"), "'none'");
  assert.equal(directives.get("form-action"), "'self'");
});
