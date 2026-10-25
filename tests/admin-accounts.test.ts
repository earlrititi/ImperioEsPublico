import test from "node:test";
import assert from "node:assert/strict";
import { accountVerificationCounts } from "../src/components/admin/Overview";

test("Pending registrations stay separate from verified email accounts", () => {
  assert.deepEqual(accountVerificationCounts([]), { total: 0, confirmed: 0, pending: 0 });
  assert.deepEqual(accountVerificationCounts([{ confirmed: true }, { confirmed: false }, { confirmed: false }]),
    { total: 3, confirmed: 1, pending: 2 });
});
