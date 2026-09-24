import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSENT_KEY, CONSENT_MAX_AGE, parseConsent, readSavedConsent, saveConsent } from "../src/lib/cookie-consent";

const version = "test-v1";
const decision = (analytics = false) => ({
  version, preferences: false, analytics, marketing: false,
  updatedAt: new Date(Date.now() - 1000).toISOString(),
});

test("acceptance, rejection and custom choices survive serialization", () => {
  for (const value of [decision(), decision(true), { ...decision(), preferences: true }]) {
    assert.deepEqual(parseConsent(JSON.stringify(value), version), value);
  }
});

test("invalid, outdated and expired decisions require a new choice", () => {
  const value = decision();
  assert.equal(parseConsent("{", version), null);
  assert.equal(parseConsent(JSON.stringify(value), "new-version"), null);
  assert.equal(parseConsent(JSON.stringify({ ...value, analytics: "true" }), version), null);
  assert.equal(parseConsent(JSON.stringify(value), version, Date.parse(value.updatedAt) + CONSENT_MAX_AGE * 1000), null);
  assert.equal(parseConsent(JSON.stringify({ ...value, updatedAt: "invalid" }), version), null);
});

test("persistent stores restore decisions and fall back when localStorage is blocked", () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const values = new Map<string, string>();
  let blocked = false;
  const fakeDocument = { cookie: "" };
  Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDocument });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { protocol: "https:" },
    localStorage: {
      getItem: (key: string) => { if (blocked) throw Error("blocked"); return values.get(key) ?? null; },
      setItem: (key: string, value: string) => { if (blocked) throw Error("blocked"); values.set(key, value); },
    },
  } });
  try {
    const accepted = decision(true);
    saveConsent(accepted);
    assert.deepEqual(readSavedConsent(version), accepted);
    assert.match(fakeDocument.cookie, /Max-Age=\d+; Path=\/; SameSite=Lax; Secure/);
    blocked = true;
    assert.deepEqual(readSavedConsent(version), accepted);
    const rejected = { ...decision(), updatedAt: new Date().toISOString() };
    saveConsent(rejected);
    blocked = false;
    assert.deepEqual(readSavedConsent(version), rejected);
    saveConsent(rejected);
    fakeDocument.cookie = "";
    assert.deepEqual(readSavedConsent(version), rejected);
    assert.equal(JSON.parse(values.get(CONSENT_KEY)!).analytics, false);
    values.clear();
    assert.equal(readSavedConsent(version), null);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
