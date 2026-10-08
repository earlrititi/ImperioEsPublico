import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_USER_IDS, isImperioAdmin } from "../src/lib/admin-identity";
import { validInteraction } from "../src/lib/interaction-validation";
test("Only confirmed Pablo and Adri UUIDs are administrators", () => {
  for (const id of ADMIN_USER_IDS) assert.equal(isImperioAdmin({ id, email_confirmed_at: "2026-01-01" }), true);
  assert.equal(isImperioAdmin({ id: ADMIN_USER_IDS[0] }), false);
  assert.equal(isImperioAdmin(null), false);
  assert.equal(isImperioAdmin({ id: "d0477488-b960-4562-94f7-775e2a12d74c", email_confirmed_at: "2026-01-01" }), false);
});
test("Analytics excludes private paths and arbitrary personal payloads", () => {
  for (const page of ["/", "/tienda", "/papeles-y-tratados/lepanto"]) assert.equal(validInteraction({ page, target: "link:/reservas", event: "click" }), true);
  for (const page of ["/admin", "/login", "/reservas/gestionar", "/cuenta", "/?email=a@b.com"]) assert.equal(validInteraction({ page, target: "page", event: "page_view" }), false);
  assert.equal(validInteraction({ page: "/", target: "someone@example.com", event: "click" }), false);
});
