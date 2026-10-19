import assert from "node:assert/strict";
import test from "node:test";
import { LEGAL_DOCUMENT_VERSIONS } from "../src/config/legal";
import { automationFacts, captureAutomationActivity, runMarketingAutomations, type AutomationSubject } from "../src/lib/automation-worker";
import { planAutomation } from "../src/lib/email-automations";

const now = Date.UTC(2026, 9, 17), iso = (hours: number) => new Date(now - hours * 3600000).toISOString();
const subject: AutomationSubject = { user_id: "server-user", email: "verified@example.invalid", name: "Lector", consent_id: "server-consent",
  marketing_accepted_at: iso(48), welcome_at: iso(48), visited_at: iso(30), product_at: iso(30), cart_at: null, checkout_at: null,
  analytics_accepted: true, analytics_version: LEGAL_DOCUMENT_VERSIONS.cookies, analytics_at: iso(48), analytics_withdrawn_at: null,
  paid_at: null, billing_record: false, payment_in_progress: false };
test("worker requires server identity and email consent and excludes paid, pending and unresolved billing", () => {
  assert.ok(automationFacts(subject, now));
  for (const invalid of [{ user_id: "" }, { email: "invalid" }, { consent_id: "" }, { marketing_accepted_at: "bad" },
    { marketing_accepted_at: iso(-1) }, { paid_at: iso(1) }, { billing_record: true }, { payment_in_progress: true }]) {
    assert.equal(automationFacts({ ...subject, ...invalid }, now), null);
  }
});
test("current, unwithdrawn analytics proof is required for behavioral recovery but not welcome", () => {
  for (const invalid of [{ analytics_accepted: false }, { analytics_withdrawn_at: iso(1) }, { analytics_version: "old" },
    { analytics_at: iso(-1) }, { analytics_at: iso(365 * 24 + 1) }, { analytics_at: null }]) {
    const facts = automationFacts({ ...subject, ...invalid }, now)!;
    assert.equal(facts.analyticsConsent, false);
    assert.equal(planAutomation(facts, [], now)[0]?.key, "welcome");
    assert.deepEqual(planAutomation({ ...facts, welcomeAt: null }, [], now), []);
  }
});
test("commercial worker and activity capture are disabled without explicit runtime flags", async () => {
  delete process.env.MARKETING_AUTOMATIONS_ENABLED; delete process.env.MARKETING_AUTOMATION_CAPTURE_ENABLED;
  assert.deepEqual(await runMarketingAutomations(), { disabled: true, queued: 0, sent: 0, suppressed: 0, failed: 0 });
  assert.deepEqual(await captureAutomationActivity("server-user", "cart"), false);
});
