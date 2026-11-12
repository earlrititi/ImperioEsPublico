import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCustomerMailService,
  type CustomerMailAuditRow,
} from "../src/lib/customer-mail-service";
const message = {
  from: "Imperio Español <contacto@imperioes.com>",
  to: "owner@example.invalid",
  subject: "Service email",
  html: '<p>Private content <a href="https://imperioes.com/auth/confirmar?token_hash=private-bearer">Continue</a></p>',
  text: "Private content",
};
function store() {
  const rows = new Map<string, CustomerMailAuditRow>();
  return {
    rows,
    db: {
      from: () => ({
        upsert: async (row: CustomerMailAuditRow) => {
          if (!rows.has(row.key)) rows.set(row.key, { ...row });
          return { error: null };
        },
        update: (patch: any) => ({
          eq: (_column: string, key: string) => ({
            in: async (_status: string, statuses: string[]) => {
              const row = rows.get(key);
              if (row && statuses.includes(row.status))
                Object.assign(row, patch);
              return { error: null };
            },
          }),
        }),
      }),
    },
  };
}
test("audit stores only metadata and digests, preserves provider result and deduplicates retries", async () => {
  const s = store(),
    service = createCustomerMailService({
      database: async () => s.db as any,
      auditEnabled: () => true,
      auditFailed: () => assert.fail("unexpected audit error"),
    }),
    result: any = { data: { id: "provider-fixture" }, error: null },
    client: any = { emails: { send: async () => result } };
  assert.equal(
    await service.sendCorporateMail(client, message, {
      idempotencyKey: "same-operation",
    }),
    result,
  );
  await service.sendCorporateMail(client, message, {
    idempotencyKey: "same-operation",
  });
  assert.equal(s.rows.size, 1);
  const saved = JSON.stringify([...s.rows.values()]);
  for (const token of ["private-bearer", "token_hash", "<p>", "html", "text"])
    assert.ok(!saved.includes(token));
  assert.equal([...s.rows.values()][0].delivery_status, "accepted_by_provider");
});
test("audit failure cannot lose a provider acceptance or alter a retry payload", async () => {
  let warnings = 0;
  const service = createCustomerMailService({
      database: async () => {
        throw Error("fixture DB unavailable");
      },
      auditEnabled: () => true,
      auditFailed: () => warnings++,
    }),
    response: any = { data: { id: "accepted" }, error: null },
    client: any = {
      emails: {
        send: async (payload: any) => {
          assert.equal(payload, message);
          return response;
        },
      },
    };
  assert.equal(
    await service.sendCorporateMail(
      client,
      message,
      { idempotencyKey: "key" },
      { preserveSnapshot: true },
    ),
    response,
  );
  assert.equal(warnings, 1);
});
test("strict Auth ledger audit:false never invokes the generic store", async () => {
  const service = createCustomerMailService({
      database: async () => assert.fail("generic store must not be used"),
      auditEnabled: () => true,
    }),
    client: any = {
      emails: {
        send: async () => ({ data: { id: "auth-provider" }, error: null }),
      },
    };
  await service.sendCorporateMail(client, message, undefined, { audit: false });
});
test("a failed keyed request may later be promoted to accepted without claiming delivery", async () => {
  const s = store(),
    service = createCustomerMailService({
      database: async () => s.db as any,
      auditEnabled: () => true,
      auditFailed: () => assert.fail(),
    }),
    client: any = {
      emails: {
        send: async () => ({ data: null, error: { name: "fixture" } }),
      },
    };
  await service.sendCorporateMail(client, message, { idempotencyKey: "retry" });
  assert.equal([...s.rows.values()][0].status, "failed");
  client.emails.send = async () => ({
    data: { id: "accepted-later" },
    error: null,
  });
  await service.sendCorporateMail(client, message, { idempotencyKey: "retry" });
  assert.equal([...s.rows.values()][0].status, "sent");
  assert.equal([...s.rows.values()][0].delivery_status, "accepted_by_provider");
});
