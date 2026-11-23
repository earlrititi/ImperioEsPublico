import { nextWelcomeStep, type AutomationStep, type WelcomeEligibility } from "./email-automations";

export function nextContactWelcome(steps: AutomationStep[], anchor: string, sent: { step: string; sent_at: string }[], now = Date.now(), facts: WelcomeEligibility = {}) {
  if (sent.some(item => Date.parse(item.sent_at) > now - 6 * 3600000 && Date.parse(item.sent_at) <= now)) return null;
  const history = sent.map(item => ({ key: "welcome" as const, step: item.step, anchor: Date.parse(anchor), sentAt: Date.parse(item.sent_at) }));
  const next = nextWelcomeStep(steps, Date.parse(anchor), history, now, facts);
  return next ? { step: steps.find(item => item.id === next.step)!, due: new Date(next.dueAt).toISOString() } : null;
}
