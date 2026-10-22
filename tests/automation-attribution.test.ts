import test from "node:test";
import assert from "node:assert/strict";
import { AUTOMATION_DEFAULTS, campaignAutomationMail, personalizeAutomation } from "../src/lib/email-automations";

test("automation links carry only shared series and step labels, never recipient identifiers", () => {
  for (const draft of AUTOMATION_DEFAULTS) for (const step of draft.steps) {
    const personalized = personalizeAutomation(step.mail, "Fixture Person");
    const result = campaignAutomationMail(personalized, draft.key, step.id);
    const url = new URL(result.cta_url);
    assert.equal(url.searchParams.get("utm_campaign"), `imperio_${draft.key}`);
    assert.equal(url.searchParams.get("utm_content"), step.id);
    assert.equal(url.searchParams.get("utm_source"), "imperio_newsletter");
    assert.equal(url.searchParams.get("utm_medium"), "email");
    assert.doesNotMatch(url.href, /Fixture|email=|user_id|token=|job_id/);
    assert.equal(result.content, personalized.content);
    assert.equal(campaignAutomationMail(result, draft.key, step.id).cta_url, result.cta_url);
  }
});

test("campaign tagging does not transform private, offsite or unexpected links", () => {
  const content = AUTOMATION_DEFAULTS[0].steps[0].mail;
  for (const cta_url of ["https://imperioes.com/cuenta", "https://imperioes.com/?email=private", "https://evil.invalid/", "", "https://imperioes.com/login?token=private"]) {
    const input = { ...content, cta_url };
    assert.equal(campaignAutomationMail(input, "welcome", "day1"), input);
  }
  assert.equal(campaignAutomationMail(content, "welcome", "recipient@example.invalid"), content);
  assert.equal(campaignAutomationMail(content, "placed_order", "day1"), content);
});
