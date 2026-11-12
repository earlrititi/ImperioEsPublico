import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  handleAuthMailRequest,
  verifyAuthMailSignature,
  type AuthMailClaim,
  type AuthMailClaimed,
  type AuthMailDependencies,
} from "../src/lib/auth-mail-hook";
const key = Buffer.alloc(32, 7),
  secret = `v1,whsec_${key.toString("base64")}`,
  now = 1_800_000_000_000;
const signup = {
  user: { email: "owner@example.invalid" },
  email_data: {
    email_action_type: "signup",
    token_hash: "opaque-hash-fixture",
    redirect_to: "https://imperioes.com/api/auth/callback?next=%2Fcuenta",
  },
};
function signed(body: string, id = "first", time = now) {
  const timestamp = String(Math.floor(time / 1000));
  return new Request("https://imperioes.com/api/auth/send-email-hook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`,
    },
    body,
  });
}
function fixture() {
  const rows = new Map<string, AuthMailClaimed & AuthMailClaim>(),
    sent: { message: any; key: string }[] = [],
    calls = { claims: 0, completes: 0, failures: 0 };
  const deps: AuthMailDependencies = {
    secret,
    now,
    idempotencySecret: "independent-idempotency-secret-fixture-32",
    siteUrl: "https://imperioes.com",
    from: "Imperio Español <contacto@imperioes.com>",
    replyTo: "contacto@imperioes.com",
    claim: async (input) => {
      calls.claims++;
      let row = rows.get(input.p_key);
      if (row && row.p_payload_digest !== input.p_payload_digest)
        throw Error("PAYLOAD_CHANGED");
      if (row?.status === "processing") return null;
      if (!row) {
        row = {
          ...input,
          id: `row-${rows.size}`,
          claim_id: "lease",
          status: "processing",
          provider_id: null,
        };
        rows.set(input.p_key, row);
      } else if (row.status !== "sent") {
        row.status = "processing";
        row.claim_id = "lease";
      }
      return { ...row };
    },
    send: async (message, options) => {
      sent.push({ message, key: options.idempotencyKey });
      return { data: { id: `provider-${sent.length}` }, error: null };
    },
    complete: async (id, claim, providerId) => {
      calls.completes++;
      const row = [...rows.values()].find((r) => r.id === id)!;
      assert.equal(claim, "lease");
      row.status = "sent";
      row.provider_id = providerId;
      row.claim_id = null;
    },
    fail: async (id) => {
      calls.failures++;
      const row = [...rows.values()].find((r) => r.id === id)!;
      row.status = "failed";
      row.claim_id = null;
    },
  };
  return { deps, rows, sent, calls };
}
test("signature covers exact bytes and tolerates only valid rotated keys and clock window", () => {
  const body = JSON.stringify(signup),
    h = signed(body).headers;
  assert.equal(verifyAuthMailSignature(body, h, secret, now), true);
  assert.equal(verifyAuthMailSignature(body + " ", h, secret, now), false);
  for (const offset of [-301000, 301000])
    assert.equal(
      verifyAuthMailSignature(
        body,
        signed(body, "clock", now + offset).headers,
        secret,
        now,
      ),
      false,
    );
  assert.equal(
    verifyAuthMailSignature(
      body,
      h,
      `whsec_${Buffer.alloc(32, 9).toString("base64")} ${secret}`,
      now,
    ),
    true,
  );
  assert.equal(
    verifyAuthMailSignature(body, h, "bad-prefix-" + secret, now),
    false,
  );
});
test("unverified, oversized and malformed inputs never claim or send", async () => {
  const f = fixture(),
    bad = signed(JSON.stringify(signup));
  bad.headers.set("webhook-signature", "v1,invalid");
  assert.equal((await handleAuthMailRequest(bad, f.deps)).status, 401);
  for (const body of [
    "{",
    JSON.stringify({ user: {}, email_data: { email_action_type: "unknown" } }),
  ])
    assert.equal(
      (await handleAuthMailRequest(signed(body), f.deps)).status,
      400,
    );
  assert.equal(
    (await handleAuthMailRequest(signed("x".repeat(128 * 1024 + 1)), f.deps))
      .status,
    413,
  );
  assert.equal(f.calls.claims, 0);
  assert.equal(f.sent.length, 0);
});
test("changed webhook-id on retry reuses accepted delivery and ledger never stores bearer content", async () => {
  const f = fixture(),
    body = JSON.stringify(signup);
  assert.equal((await handleAuthMailRequest(signed(body), f.deps)).status, 200);
  assert.equal(
    (await handleAuthMailRequest(signed(body, "retry"), f.deps)).status,
    200,
  );
  assert.equal(f.sent.length, 1);
  assert.equal(f.calls.completes, 1);
  assert.match(f.sent[0].message.html, /data-imperio-email-layout/);
  const ledger = JSON.stringify([...f.rows.values()]);
  for (const value of ["opaque-hash-fixture", "token_hash", "<html"])
    assert.ok(!ledger.includes(value));
});
test("parallel retry cannot obtain another live lease", async () => {
  const f = fixture(),
    body = JSON.stringify(signup);
  let release!: () => void, entered!: () => void;
  const started = new Promise<void>((r) => {
      entered = r;
    }),
    gate = new Promise<void>((r) => {
      release = r;
    }),
    normal = f.deps.send;
  f.deps.send = async (...args) => {
    entered();
    await gate;
    return normal(...args);
  };
  const first = handleAuthMailRequest(signed(body), f.deps);
  await started;
  assert.equal(
    (await handleAuthMailRequest(signed(body, "concurrent"), f.deps)).status,
    503,
  );
  release();
  assert.equal((await first).status, 200);
  assert.equal(
    (await handleAuthMailRequest(signed(body, "after"), f.deps)).status,
    200,
  );
  assert.equal(f.sent.length, 1);
});
test("partial secure email change retries only the missing recipient", async () => {
  const f = fixture(),
    body = JSON.stringify({
      user: { email: "old@example.invalid", new_email: "new@example.invalid" },
      email_data: {
        email_action_type: "email_change",
        token: "12345678",
        token_new: "87654321",
        token_hash: "new-hash",
        token_hash_new: "old-hash",
      },
    }),
    normal = f.deps.send;
  let failed = false;
  f.deps.send = async (message, options) => {
    if (message.to.startsWith("new@") && !failed) {
      failed = true;
      return { data: null, error: { name: "fixture" } };
    }
    return normal(message, options);
  };
  assert.equal((await handleAuthMailRequest(signed(body), f.deps)).status, 503);
  assert.equal(
    (await handleAuthMailRequest(signed(body, "retry"), f.deps)).status,
    200,
  );
  assert.deepEqual(f.sent.map((s) => s.message.to).sort(), [
    "new@example.invalid",
    "old@example.invalid",
  ]);
});
test("uncertain provider acceptance reuses key; changed retry payload fails closed", async () => {
  const f = fixture(),
    body = JSON.stringify(signup),
    keys: string[] = [];
  let count = 0;
  f.deps.send = async (_message, options) => {
    keys.push(options.idempotencyKey);
    if (++count === 1) throw Error("timeout after acceptance");
    return { data: { id: "same-operation" }, error: null };
  };
  assert.equal((await handleAuthMailRequest(signed(body), f.deps)).status, 503);
  assert.equal(
    (await handleAuthMailRequest(signed(body, "retry"), f.deps)).status,
    200,
  );
  assert.equal(keys[0], keys[1]);
  assert.equal(f.calls.failures, 1);
  const changed = fixture();
  changed.deps.send = async () => ({ data: null, error: { name: "fixture" } });
  assert.equal(
    (await handleAuthMailRequest(signed(body), changed.deps)).status,
    503,
  );
  changed.deps.from = "Different <different@example.invalid>";
  assert.equal(
    (await handleAuthMailRequest(signed(body, "changed"), changed.deps)).status,
    503,
  );
  assert.equal(changed.calls.failures, 1);
});
test("configuration and method guards precede delivery", async () => {
  const f = fixture();
  f.deps.idempotencySecret = "short";
  assert.equal(
    (await handleAuthMailRequest(signed(JSON.stringify(signup)), f.deps))
      .status,
    503,
  );
  assert.equal(
    (
      await handleAuthMailRequest(
        new Request("https://imperioes.com/api/auth/send-email-hook"),
        f.deps,
      )
    ).status,
    405,
  );
  assert.equal(f.calls.claims, 0);
});
