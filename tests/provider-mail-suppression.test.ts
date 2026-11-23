import test from "node:test";
import assert from "node:assert/strict";
import { recordProviderSuppressed } from "../src/lib/provider-mail-suppression";

test("provider suppression is normalized and does not overwrite any existing reason", async () => {
  const rows = new Map<string, string>([
    ["complaint@example.invalid", "provider_complained"],
    ["withdrawn@example.invalid", "unsubscribe"],
  ]);
  const store = {
    from(table: string) {
      assert.equal(table, "email_suppressions");
      return { async upsert(row: { email: string; reason: string }, options: unknown) {
        assert.deepEqual(options, { onConflict: "email", ignoreDuplicates: true });
        assert.equal(row.reason, "provider_suppressed");
        if (!rows.has(row.email)) rows.set(row.email, row.reason);
        return { error: null };
      } };
    },
  };
  await recordProviderSuppressed(" Reader@Example.invalid ", store);
  await Promise.all([recordProviderSuppressed("reader@example.invalid", store), recordProviderSuppressed("reader@example.invalid", store)]);
  await recordProviderSuppressed("complaint@example.invalid", store);
  await recordProviderSuppressed("withdrawn@example.invalid", store);
  assert.equal(rows.size, 3);
  assert.equal(rows.get("reader@example.invalid"), "provider_suppressed");
  assert.equal(rows.get("complaint@example.invalid"), "provider_complained");
  assert.equal(rows.get("withdrawn@example.invalid"), "unsubscribe");
});

test("invalid recipient is rejected before accessing the suppression store", async () => {
  const store = { from() { throw Error("must not access database"); } };
  for (const email of ["", "invalid", "person@example.invalid\r\nBcc: other@example.invalid", "Display <person@example.invalid>", `${"x".repeat(255)}@example.invalid`])
    await assert.rejects(recordProviderSuppressed(email, store), /INVALID_SUPPRESSION_RECIPIENT/);
});

test("an unavailable store fails so receipt reconciliation or webhook can retry", async () => {
  const store = { from() { return { async upsert() { return { error: "private database detail" }; } }; } };
  await assert.rejects(recordProviderSuppressed("reader@example.invalid", store), /^Error: PROVIDER_SUPPRESSION_UNAVAILABLE$/);
});
