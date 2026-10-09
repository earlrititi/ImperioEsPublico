import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("admin page guards run in page frontmatter, not only inside a layout", () => {
  for (const route of ["index", "embudo", "interacciones", "suscripciones", "comercio", "correos", "newsletter", "articles"]) {
    const source = readFileSync(new URL(`../src/pages/admin/${route}.astro`, import.meta.url), "utf8");
    const frontmatter = source.split("---")[1];
    assert.match(frontmatter, /await requireAdmin\(Astro\)/);
    assert.match(frontmatter, /prerender\s*=\s*false/);
  }
});
test("opening a subscription checkout never sends an owner purchase notice", () => {
  const source = readFileSync(new URL("../src/pages/api/create-checkout-session.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /notifyLead/);
  assert.match(source, /guardedSubscriptionCheckout/);
  assert.match(source, /user\?\.email_confirmed_at \? existingCustomerId : undefined/);
});
