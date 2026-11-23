import test from "node:test";
import assert from "node:assert/strict";
import { createCommercialMailCoordinator } from "../src/lib/commercial-mail-coordinator";

const payload = { to: "synthetic@example.invalid", from: "Imperio <mail@example.invalid>", subject: "Fixture", text: "Fixture" };
test("commercial reservation rejects incomplete receipts and never calls a provider itself", async () => {
  for (const response of [null, { action: "unknown" }, { action: "send" }, { action: "accepted" }]) {
    const coordinator = createCommercialMailCoordinator(async () => response);
    await assert.rejects(coordinator.beginCommercialSend({ source: "automation", jobId: "job", claimId: "claim", payload }));
  }
});
test("provider acceptance commits durably before optional archive; a failed archive cannot resend", async () => {
  const calls: string[] = [];
  const coordinator = createCommercialMailCoordinator(async name => {
    calls.push(name);
    if (name === "reserve_commercial_mail") return { action: "send", receipt_id: "receipt", receipt_claim_id: "lease" };
    return true;
  }, async () => { calls.push("archive"); throw Error("synthetic archive unavailable"); });
  const reservation = await coordinator.beginCommercialSend({ source: "automation", jobId: "job", claimId: "claim", payload });
  await coordinator.completeCommercialSend(reservation, "provider_fixture");
  assert.deepEqual(calls, ["reserve_commercial_mail", "complete_customer_mail", "archive"]);
});
test("uncertain outcome stays attached to the same receipt; failed completion is observable", async () => {
  const calls: string[] = [];
  const coordinator = createCommercialMailCoordinator(async name => {
    calls.push(name);
    if (name === "reserve_commercial_mail") return { action: "send", receipt_id: "receipt", receipt_claim_id: "lease" };
    return name === "fail_customer_mail";
  });
  const reservation = await coordinator.beginCommercialSend({ source: "admin", jobId: "job", claimId: "claim", payload });
  await assert.rejects(coordinator.completeCommercialSend(reservation, "provider_fixture"), /COMMERCIAL_RECEIPT_UNAVAILABLE/);
  await coordinator.failCommercialSend(reservation);
  assert.deepEqual(calls, ["reserve_commercial_mail", "complete_customer_mail", "fail_customer_mail"]);
});
