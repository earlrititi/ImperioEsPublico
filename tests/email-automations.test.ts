import test from "node:test";
import assert from "node:assert/strict";
import { AUTOMATION_DEFAULTS, personalizeAutomation, planAutomation, validateAutomationDraft,
  type AutomationFacts, type AutomationSent } from "../src/lib/email-automations";

const hour = 3600000;
const start = Date.UTC(2026, 9, 1);
const facts: AutomationFacts = { identified: true, verifiedEmail: true, marketingAcceptedAt: start,
  withdrawn: false, suppressed: false, analyticsConsent: true, paidAt: null, welcomeAt: null,
  visitedAt: null, productAt: null, cartAt: null, checkoutAt: null };

test("six sequences keep requested cadence and existing transactional order channel", () => {
  assert.equal(AUTOMATION_DEFAULTS.length, 6);
  assert.deepEqual(AUTOMATION_DEFAULTS[0].steps.map(item => item.afterHours), [24, 72, 120, 192, 288]);
  assert.deepEqual(AUTOMATION_DEFAULTS[1].steps.map(item => item.afterHours), [1, 24, 72]);
  assert.deepEqual(AUTOMATION_DEFAULTS.find(item => item.key === "cart")!.steps.map(item => item.afterHours), [4, 24]);
  assert.deepEqual(AUTOMATION_DEFAULTS.find(item => item.key === "placed_order")!.steps, []);
});

test("all editable defaults validate, rejecting arbitrary offsets, variables and offsite links", () => {
  for (const definition of AUTOMATION_DEFAULTS.filter(item => item.key !== "placed_order")) {
    assert.deepEqual(validateAutomationDraft(definition.key, definition.steps), definition.steps);
    const invalid = structuredClone(definition.steps); invalid[0].afterHours++;
    assert.throws(() => validateAutomationDraft(definition.key, invalid), /INVALID_INPUT/);
  }
  const bad = structuredClone(AUTOMATION_DEFAULTS[1].steps);
  bad[0].mail.content = "{{email}}";
  assert.throws(() => validateAutomationDraft("checkout", bad), /INVALID_INPUT/);
  bad[0].mail.content = "Hola"; bad[0].mail.cta_url = "https://evil.example";
  assert.throws(() => validateAutomationDraft("checkout", bad), /INVALID_INPUT/);
  assert.throws(() => validateAutomationDraft("placed_order", []), /INVALID_INPUT/);
});

test("personalization normalizes header-breaking input and the renderer handles HTML as text", () => {
  const output = personalizeAutomation(AUTOMATION_DEFAULTS[0].steps[0].mail, "Ana\r\nBcc: nadie");
  assert.ok(output.content.includes("Hola Ana  Bcc: nadie"));
  assert.ok(!output.content.includes("{{nombre}}"));
});

test("unidentified, unverified, unconsented, withdrawn and suppressed recipients never qualify", () => {
  for (const denied of [{ identified: false }, { verifiedEmail: false }, { marketingAcceptedAt: null },
    { marketingAcceptedAt: NaN }, { withdrawn: true }, { suppressed: true }]) {
    assert.deepEqual(planAutomation({ ...facts, checkoutAt: start, ...denied }, [], start + 2 * hour), []);
  }
});

test("verified purchase cancels every commercial recovery even when another action is more recent", () => {
  assert.deepEqual(planAutomation({ ...facts, paidAt: start + hour, welcomeAt: start, cartAt: start + 3 * hour }, [], start + 80 * hour), []);
});

test("behavioral followups require analytics as well as email consent; welcome does not require analytics", () => {
  assert.deepEqual(planAutomation({ ...facts, analyticsConsent: false, cartAt: start }, [], start + 5 * hour), []);
  assert.equal(planAutomation({ ...facts, analyticsConsent: false, welcomeAt: start }, [], start + 25 * hour)[0]?.key, "welcome");
});

test("no retrospective behavioral followups for activity before consent or in the future", () => {
  assert.deepEqual(planAutomation({ ...facts, checkoutAt: start - hour }, [], start + 5 * hour), []);
  assert.deepEqual(planAutomation({ ...facts, checkoutAt: start + 100 * hour }, [], start + 5 * hour), []);
});

test("checkout takes precedence over cart, product and site recovery", () => {
  const planned = planAutomation({ ...facts, checkoutAt: start, cartAt: start, productAt: start, visitedAt: start }, [], start + 25 * hour);
  assert.equal(planned.length, 1); assert.equal(planned[0].key, "checkout"); assert.equal(planned[0].step, "hour24");
});

test("cart takes precedence over product and site; product takes precedence over site", () => {
  assert.equal(planAutomation({ ...facts, cartAt: start, productAt: start, visitedAt: start }, [], start + 25 * hour)[0]?.key, "cart");
  assert.equal(planAutomation({ ...facts, productAt: start, visitedAt: start }, [], start + 49 * hour)[0]?.key, "viewed_product");
});

test("a delayed worker skips older steps instead of sending a welcome backlog", () => {
  const first = planAutomation({ ...facts, welcomeAt: start }, [], start + 290 * hour);
  assert.equal(first[0]?.step, "day12");
  const sent: AutomationSent[] = [{ ...first[0], sentAt: start + 290 * hour }];
  assert.deepEqual(planAutomation({ ...facts, welcomeAt: start }, sent, start + 310 * hour), []);
});

test("completed step is never duplicated and short-interval sends are capped", () => {
  const sent: AutomationSent[] = [{ key: "checkout", step: "hour1", anchor: start, sentAt: start + hour }];
  assert.deepEqual(planAutomation({ ...facts, checkoutAt: start }, sent, start + 2 * hour), []);
  assert.equal(planAutomation({ ...facts, checkoutAt: start }, sent, start + 24 * hour)[0]?.step, "hour24");
  assert.deepEqual(planAutomation({ ...facts, checkoutAt: start }, [{ ...sent[0], sentAt: start + 23 * hour }], start + 24 * hour), []);
});

test("old enrollments do not restart automatically", () => {
  assert.deepEqual(planAutomation({ ...facts, cartAt: start, welcomeAt: start }, [], start + 15 * 24 * hour), []);
});

test("commercial sequences never claim a payment or shipment; each has an actionable CTA", () => {
  for (const definition of AUTOMATION_DEFAULTS) for (const step of definition.steps) {
    assert.doesNotMatch(step.mail.content, /ya ha sido enviada|est[a\u00e1] en camino|pago confirmado|compra confirmada/i);
    assert.match(step.mail.content, /^Hola {{nombre}},/);
    assert.ok(step.mail.cta_label && step.mail.cta_url);
  }
});
