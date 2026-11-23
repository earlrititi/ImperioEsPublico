import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AUTOMATION_DEFAULTS, automationKeysForScope, planAutomation, validateAutomationDraft } from "../src/lib/email-automations";
import { automationFacts } from "../src/lib/automation-worker";

// Offline preparation only: this command neither connects to a service nor applies approval.
const snapshotPath = process.argv[2], destination = process.argv[3];
assert.ok(snapshotPath && destination, "Usage: node --import tsx scripts/prepare-recovery-review.ts snapshot.json output-directory");
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
assert.ok(snapshot.checked_at && snapshot.runtime?.length === 1 && Array.isArray(snapshot.drafts));
const runtime = snapshot.runtime[0];
assert.match(runtime.template_digest, /^[a-f0-9]{64}$/);
const drafts = snapshot.drafts as Array<{ key: string; revision: number; steps: unknown }>;
assert.equal(new Set(drafts.map(draft => draft.key)).size, drafts.length);
const keys = automationKeysForScope("recovery")!;
const definitions = AUTOMATION_DEFAULTS.filter(item => item.key !== "placed_order").map(definition => {
  const stored = drafts.find(item => item.key === definition.key);
  if (!stored) return definition;
  assert.ok(Number.isInteger(stored.revision) && stored.revision >= 0);
  return { ...definition, revision: stored.revision, steps: validateAutomationDraft(definition.key, stored.steps) };
});
const recovery = definitions.filter(definition => keys.includes(definition.key));
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
let qualifyingFacts = 0, potentiallyDueWithoutHistory = 0;
for (const subject of snapshot.facts ?? []) {
  const facts = automationFacts({ ...subject, user_id: "snapshot", email: "snapshot@example.invalid", consent_id: "snapshot" });
  if (!facts) continue;
  qualifyingFacts++;
  if (planAutomation(facts, [], Date.now(), keys).length) potentiallyDueWithoutHistory++;
}
const review = { prepared_at: new Date().toISOString(), snapshot_checked_at: snapshot.checked_at,
  scope: "recovery", enabled_keys: keys, approved_digest_before: runtime.template_digest,
  current_full_digest: digest(definitions), recovery_digest: digest(recovery),
  qualifying_facts: qualifyingFacts, potentially_due_without_history: potentiallyDueWithoutHistory,
  activation_changes: { preserve_existing_enrollment_cutoff: true, recovery_activity_starts_at_approval: true, other_families_disabled_by_scope: true },
  definitions: recovery };
const directory = resolve(destination);
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, "recovery-review.json"), JSON.stringify(review, null, 2) + "\n");
console.log(JSON.stringify({ ...review, definitions: recovery.map(item => ({ key: item.key, revision: item.revision,
  steps: item.steps.map(step => ({ id: step.id, afterHours: step.afterHours, subject: step.mail.subject, cta: step.mail.cta_url })) })) }));
