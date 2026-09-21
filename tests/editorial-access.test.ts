import assert from "node:assert/strict";
import test from "node:test";
import { hasEditorialAccess } from "../src/lib/editorial-access";

test("Editorial access requires a verified account and a server-assigned boolean permission", () => {
  assert.equal(hasEditorialAccess(null), false);
  assert.equal(hasEditorialAccess({ app_metadata: { editorial_admin: true } }), false);
  assert.equal(hasEditorialAccess({ email_confirmed_at: "2026-09-15" }), false);
  assert.equal(hasEditorialAccess({ email_confirmed_at: "2026-09-15", app_metadata: { editorial_admin: "true" } }), false);
  assert.equal(hasEditorialAccess({ email_confirmed_at: "2026-09-15", app_metadata: { commerce_admin: true } }), false);
  assert.equal(hasEditorialAccess({ email_confirmed_at: "2026-09-15", app_metadata: { editorial_admin: true } }), true);
});
