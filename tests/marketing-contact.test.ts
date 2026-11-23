import test from "node:test";
import assert from "node:assert/strict";
import {contactTokenHash,contactVerificationToken,normalizedContactEmail,validContactToken} from "../src/lib/marketing-contact-token";
import {nextContactWelcome} from "../src/lib/contact-welcome-plan";
import {AUTOMATION_DEFAULTS} from "../src/lib/email-automations";
const id="00000000-0000-4000-8000-000000000011",secret="isolated-test-secret-for-email-proof-0000",expires="2026-11-08T12:00:00Z",now=Date.parse("2026-11-07T12:00:00Z");
test("email confirmation is scoped to one identity, purpose, expiry and secret",()=>{
  const token=contactVerificationToken(id,expires,secret);
  assert.equal(validContactToken(id,expires,token,secret,now),true);
  assert.equal(validContactToken(id,expires,token,secret,Date.parse(expires)+1),false);
  assert.equal(validContactToken(id.replace(/11$/,"12"),expires,token,secret,now),false);
  assert.equal(validContactToken(id,expires,token,secret+"x",now),false);
  assert.equal(validContactToken(id,expires,"invalid",secret,now),false);
  assert.notEqual(contactTokenHash(token),token);
  assert.equal(normalizedContactEmail(" Reader@Example.invalid "),"reader@example.invalid");
});
test("a confirmed contact uses one welcome series without a burst or restart",()=>{
  const steps=AUTOMATION_DEFAULTS.find(d=>d.key==="welcome")!.steps,anchor=new Date(now-360*3600000).toISOString();
  assert.equal(nextContactWelcome(steps,anchor,[],now)?.step.id,steps[0].id);
  const old={step:steps[0].id,sent_at:new Date(now-7*3600000).toISOString()};
  assert.equal(nextContactWelcome(steps,anchor,[old],now)?.step.id,steps.at(-1)!.id);
  assert.equal(nextContactWelcome(steps,anchor,[{...old,sent_at:new Date(now-3600000).toISOString()}],now),null);
  assert.equal(nextContactWelcome(steps,anchor,steps.map(s=>({step:s.id,sent_at:old.sent_at})),now),null);
  assert.equal(nextContactWelcome(steps,"invalid",[],now),null);
  assert.equal(nextContactWelcome(steps,new Date(now+1).toISOString(),[],now),null);
});

test("a converted contact keeps editorial content but does not receive converted offers", () => {
  const steps=AUTOMATION_DEFAULTS[0].steps,anchor=new Date(now-290*3600000).toISOString();
  const sent=[{step:"day1",sent_at:new Date(now-48*3600000).toISOString()}];
  const paid={paidAt:now-24*3600000,activeSubscription:true};
  assert.equal(nextContactWelcome(steps,anchor,sent,now,paid)?.step.id,"day5");
  assert.equal(nextContactWelcome(steps,anchor,[...sent,{...sent[0],step:"day5"}],now,paid),null);
});
