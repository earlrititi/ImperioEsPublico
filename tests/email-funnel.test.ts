import test from "node:test";
import assert from "node:assert/strict";
import {
  currentEmailFor,
  defaultSequence,
  derivePhase,
  economySummary,
  emailBreakdown,
  enrichContact,
  largestDropoff,
  money,
  monthlyCents,
  normalizeSequence,
  parseFunnelQuery,
  percentage,
  periodRange,
  phaseSummary,
  validEmail,
  type FunnelContact,
  type WelcomeJob,
} from "../src/lib/email-funnel-model";

const sequence = normalizeSequence([
  { id: "day1", afterHours: 0, mail: { subject: "Bienvenida", cta_url: "https://imperioes.com/" } },
  { id: "day3", afterHours: 72, mail: { subject: "Historia", cta_url: "https://imperioes.com/historia" } },
  { id: "day8", afterHours: 192, mail: { subject: "Oferta", cta_url: "https://imperioes.com/suscribirse" } },
]);

test("sequence is derived from the editable drafts and classifies offer by CTA", () => {
  assert.deepEqual(sequence.map(step => step.kind), ["welcome", "nurture", "offer"]);
  assert.deepEqual(sequence.map(step => step.after_hours), [0, 72, 192]);
  assert.equal(sequence[2].label, "Oferta");
  assert.equal(defaultSequence().length, 5);
  assert.deepEqual(normalizeSequence("broken").map(step => step.id), defaultSequence().map(step => step.id));
});

test("phase precedence is conversion, then exit/incident, then the furthest sent kind", () => {
  assert.equal(derivePhase({ converted: true, suppressed: true, bounced: 3, complained: 1, sentKinds: ["offer"] }), 4);
  assert.equal(derivePhase({ converted: false, suppressed: true, bounced: 0, complained: 0, sentKinds: ["offer"] }), 5);
  assert.equal(derivePhase({ converted: false, suppressed: false, bounced: 1, complained: 0, sentKinds: ["nurture"] }), 5);
  assert.equal(derivePhase({ converted: false, suppressed: false, bounced: 0, complained: 0, sentKinds: [] }), 0);
  assert.equal(derivePhase({ converted: false, suppressed: false, bounced: 0, complained: 0, sentKinds: ["welcome", "nurture"] }), 2);
  assert.equal(derivePhase({ converted: false, suppressed: false, bounced: 0, complained: 0, sentKinds: ["welcome", "offer"] }), 3);
});

test("current email reports Email X de N and never invents a sent step", () => {
  const welcomeAt = "2026-11-01T00:00:00.000Z";
  const jobs: WelcomeJob[] = [
    { id: "a", step: "day1", status: "sent", due_at: welcomeAt, sent_at: welcomeAt, delivery_status: "delivered", delivered_at: welcomeAt, reason: null, attempts: 1, provider_id: "p1" },
    { id: "b", step: "day3", status: "pending", due_at: "2026-11-04T00:00:00.000Z", sent_at: null, delivery_status: null, delivered_at: null, reason: null, attempts: 0, provider_id: null },
  ];
  const current = currentEmailFor(sequence, jobs);
  assert.equal(current.position, 2);
  assert.equal(current.total, 3);
  assert.equal(current.step_id, "day3");
  assert.equal(current.status, "programado");
  assert.equal(current.next_due_at, "2026-11-04T00:00:00.000Z");

  const idle = currentEmailFor(sequence, []);
  assert.equal(idle.position, 1);
  assert.equal(idle.next_due_at, null);
  assert.equal(idle.status, "sin programar");

  const completed = currentEmailFor(sequence, jobs.filter(job => job.status === "sent"));
  assert.equal(completed.step_id, "day3");
  assert.equal(completed.next_due_at, null);
  assert.equal(completed.status, "sin programar");
});

test("email breakdown counts real provider signals and finds the largest drop-off", () => {
  const contact = (email: string, jobs: WelcomeJob[]) => ({
    email, welcome_jobs: jobs,
  } as FunnelContact);
  const job = (step: string, events: Record<string, number>): WelcomeJob => ({
    id: `${step}-${Math.random()}`, step, status: "sent", due_at: "2026-11-01T00:00:00.000Z",
    sent_at: "2026-11-01T00:00:00.000Z", delivery_status: "delivered", delivered_at: "2026-11-01T00:00:00.000Z",
    reason: null, attempts: 1, provider_id: "p", events,
  });
  const rows = emailBreakdown(sequence, [
    contact("a@example.com", [job("day1", { delivered: 1, opened: 1, clicked: 1 }), job("day3", { delivered: 1, opened: 1 })]),
    contact("b@example.com", [job("day1", { delivered: 1, opened: 1 })]),
    contact("c@example.com", [job("day1", { delivered: 1 })]),
  ]);
  assert.deepEqual(rows.map(row => row.people), [3, 1, 0]);
  assert.deepEqual(rows.map(row => row.sent), [3, 1, 0]);
  assert.equal(rows[0].delivered, 3);
  assert.equal(rows[0].opened, 2);
  assert.equal(rows[0].clicked, 1);
  assert.equal(rows[1].lost_from_previous, 2);
  assert.equal(rows[1].loss_rate, 2 / 3);
  assert.equal(largestDropoff(rows)?.step_id, "day3");
});

test("phase summary and economy use real plans and never infer revenue from email activity", () => {
  const base = { active_paid: false, maestre: false, arcabucero: false, subscription_interval: null } as Partial<FunnelContact>;
  const contacts = [
    { ...base, phase: 0 },
    { ...base, phase: 1 },
    { ...base, phase: 4, active_paid: true, maestre: true, subscription_interval: "month", subscription_revenue_cents: 399 },
    { ...base, phase: 5 },
  ] as FunnelContact[];
  const phases = phaseSummary(contacts);
  assert.deepEqual(phases.map(phase => phase.people), [1, 1, 0, 0, 1, 1]);
  const economy = economySummary(contacts);
  assert.equal(economy.mrr_cents, 399);
  assert.equal(economy.arr_cents, 4788);
  assert.equal(economy.subscription_revenue_cents, 399);
  assert.equal(economy.shop_revenue_cents, 0);
  assert.equal(monthlyCents("maestre_campo", "year"), Math.round(3799 / 12));
  assert.equal(monthlyCents("arcabucero", "month"), 199);
  assert.equal(monthlyCents("piquero", "month"), 0);
});

test("contact enrichment derives the funnel state and leaves campaign attribution honest", () => {
  const row = {
    email: "a@example.com", name: null, captured_at: "2026-11-01T00:00:00.000Z", sources: ["manifiesto"],
    audience_state: "active", suppressed: false, suppression_reason: null, preference: true, verified_at: null,
    welcome_at: null, welcome_jobs: [], funnel_sequence: sequence, sent_count: 0, pending_count: 0,
    delivered_count: 0, opened_count: 0, clicked_count: 0, bounced_count: 0, complained_count: 0, failed_count: 0,
    last_sent_at: null, next_due_at: null, last_opened_at: null, last_clicked_at: null, phase: 0, converted: false,
    active_paid: false, maestre: false, arcabucero: false, buyer: false, is_account: false, order_count: 0,
    shop_revenue_cents: 0, subscription_revenue_cents: 0, subscription_interval: null, subscribed_at: null,
    renews_at: null, last_order_at: null, last_payment_at: null, last_checkout_at: null,
  } as FunnelContact;
  const enriched = enrichContact(row, sequence);
  assert.equal(enriched.origin, "manifiesto");
  assert.equal(enriched.campaign, "Sin atribución");
  assert.equal(enriched.funnel_state, "lead");
  assert.equal(enriched.phase_label, "Lead captado");
  assert.equal(enriched.current_email.position, 1);
});

test("query filters are validated and custom periods require a valid range", () => {
  assert.throws(() => parseFunnelQuery(new URLSearchParams("period=custom")), /INVALID_INPUT/);
  assert.throws(() => parseFunnelQuery(new URLSearchParams("period=custom&from=2026-11-05&to=2026-11-01")), /INVALID_INPUT/);
  assert.throws(() => parseFunnelQuery(new URLSearchParams("phase=9")), /INVALID_INPUT/);
  assert.throws(() => parseFunnelQuery(new URLSearchParams("pageSize=1000")), /INVALID_INPUT/);
  const parsed = parseFunnelQuery(new URLSearchParams("period=custom&from=2026-11-01&to=2026-11-09&phase=3&active=1&inactive=1&campaign=Sin%20atribuci%C3%B3n&step=day8&sort=revenue"));
  assert.equal(parsed.period, "custom");
  assert.equal(parsed.from, "2026-11-01");
  assert.equal(parsed.to, "2026-11-09");
  assert.equal(parsed.phase, 3);
  assert.equal(parsed.active, true);
  assert.equal(parsed.inactive, true);
  assert.equal(parsed.campaign, "Sin atribución");
  assert.equal(parsed.step, "day8");
  assert.equal(parsed.sort, "revenue");
  assert.equal(parseFunnelQuery(new URLSearchParams("phase=")).phase, null);
});

test("period ranges compare against the immediately previous window", () => {
  const now = new Date("2026-11-09T12:00:00.000Z");
  const week = periodRange({ period: "7d", from: null, to: null }, now);
  assert.equal(week.days, 7);
  assert.equal(week.to, now.toISOString());
  assert.equal(week.previousTo, week.from);
  const all = periodRange({ period: "all", from: null, to: null }, now);
  assert.deepEqual(all, { from: null, to: null, previousFrom: null, previousTo: null, days: null });
  const month = periodRange({ period: "month", from: null, to: null }, now);
  assert.equal(month.from, "2026-11-01T00:00:00.000Z");
  assert.equal(month.previousFrom, "2026-10-01T00:00:00.000Z");
  assert.equal(month.previousTo, "2026-10-31T23:59:59.999Z");
});

test("formatting helpers stay honest on empty samples", () => {
  assert.equal(percentage(null), null);
  assert.equal(percentage(0.256), "25.6 %");
  assert.equal(money(399).replace(/\s/g, " "), "3,99 €");
  assert.equal(validEmail("person@example.com"), true);
  assert.equal(validEmail("person@localhost"), false);
  assert.equal(validEmail("person@example.com "), false);
});
