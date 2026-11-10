export type StepKind = "welcome" | "nurture" | "offer";
export type SequenceStep = {
  id: string;
  kind: StepKind;
  after_hours: number;
  label: string;
};
export type ProviderEventCounts = {
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
};
export type WelcomeJob = {
  id: string;
  step: string;
  status: string;
  due_at: string | null;
  sent_at: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
  reason: string | null;
  attempts: number;
  provider_id: string | null;
  kind?: StepKind;
  events?: Partial<ProviderEventCounts>;
};
export type FunnelContact = {
  email: string;
  name: string | null;
  captured_at: string;
  sources: string[] | null;
  audience_state: string | null;
  suppressed: boolean | null;
  suppression_reason: string | null;
  preference: boolean | null;
  verified_at: string | null;
  welcome_at: string | null;
  welcome_jobs: WelcomeJob[] | null;
  funnel_sequence: SequenceStep[] | null;
  sent_count: number;
  pending_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  failed_count: number;
  last_sent_at: string | null;
  next_due_at: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  phase: number;
  converted: boolean;
  active_paid: boolean;
  maestre: boolean;
  arcabucero: boolean;
  buyer: boolean;
  is_account: boolean;
  order_count: number;
  shop_revenue_cents: number;
  subscription_revenue_cents: number;
  subscription_interval: string | null;
  subscribed_at: string | null;
  renews_at: string | null;
  last_order_at: string | null;
  last_payment_at: string | null;
  last_checkout_at: string | null;
};
export type FunnelContactRow = FunnelContact & {
  phase_label: string;
  funnel_state: string;
  current_email: {
    position: number;
    total: number;
    step_id: string;
    label: string;
    status: string;
    next_due_at: string | null;
    last_sent_at: string | null;
  };
  origin: string;
  campaign: string;
  revenue_cents: number;
};

export const PHASES = [
  { id: 0, label: "Lead captado" },
  { id: 1, label: "Bienvenida" },
  { id: 2, label: "Nurturing / contenido" },
  { id: 3, label: "Oferta" },
  { id: 4, label: "Conversión" },
  { id: 5, label: "Salida / incidencia" },
] as const;

const OFFER_PATH = /\/(tienda|suscribirse|precios|checkout|carrito)(\/|$|[?#])/i;
const STEP_KINDS: StepKind[] = ["welcome", "nurture", "offer"];

export function phaseLabel(phase: number) {
  return PHASES.find(item => item.id === phase)?.label ?? "Sin clasificar";
}

export function classifyStep(ctaUrl: string | null | undefined, index: number): StepKind {
  if (ctaUrl && OFFER_PATH.test(ctaUrl)) return "offer";
  return index === 0 ? "welcome" : "nurture";
}

export function normalizeSequence(input: unknown): SequenceStep[] {
  if (!Array.isArray(input)) return defaultSequence();
  const steps = input.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, any>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id || id.length > 80) return [];
    const cta = item.mail?.cta_url ?? item.cta_url ?? "";
    const declared = typeof item.kind === "string" && STEP_KINDS.includes(item.kind as StepKind) ? item.kind as StepKind : null;
    const kind = declared ?? classifyStep(typeof cta === "string" ? cta : "", index);
    const hours = Number(item.afterHours ?? item.after_hours);
    const subject = item.mail?.subject ?? item.subject;
    return [{
      id,
      kind,
      after_hours: Number.isFinite(hours) && hours >= 0 ? hours : 0,
      label: typeof subject === "string" && subject.trim() ? subject.trim().slice(0, 120) : id,
    }];
  });
  return steps.length ? steps : defaultSequence();
}

export function defaultSequence(): SequenceStep[] {
  return [
    { id: "day1", kind: "welcome", after_hours: 0, label: "Bienvenida y 7 historias" },
    { id: "day3", kind: "nurture", after_hours: 72, label: "Una historia para leer con calma" },
    { id: "day5", kind: "nurture", after_hours: 120, label: "Las personas detrás de Imperio Español" },
    { id: "day8", kind: "offer", after_hours: 192, label: "Nuestra primera camiseta, al detalle" },
    { id: "day12", kind: "offer", after_hours: 288, label: "Sigamos construyendo Imperio Español" },
  ];
}

export function kindPhase(kind: StepKind) {
  return kind === "offer" ? 3 : kind === "nurture" ? 2 : 1;
}

export function derivePhase(params: {
  converted: boolean;
  suppressed: boolean;
  bounced: number;
  complained: number;
  sentKinds: StepKind[];
}) {
  if (params.converted) return 4;
  if (params.suppressed || params.bounced > 0 || params.complained > 0) return 5;
  if (!params.sentKinds.length) return 0;
  return Math.max(...params.sentKinds.map(kindPhase));
}

export function currentEmailFor(sequence: SequenceStep[], jobs: WelcomeJob[]) {
  const ordered = [...jobs].sort((a, b) => (a.due_at ?? a.sent_at ?? "").localeCompare(b.due_at ?? b.sent_at ?? ""));
  const sent = ordered.filter(job => job.status === "sent");
  const pending = ordered.filter(job => job.status === "pending" || job.status === "processing");
  const nextPending = pending[0] ?? null;
  const lastSent = sent.at(-1) ?? null;
  const known = new Set(ordered.map(job => job.step));
  const firstMissing = sequence.find(step => !known.has(step.id)) ?? null;
  const currentStep = nextPending?.step ?? firstMissing?.id ?? lastSent?.step ?? sequence[0]?.id ?? "";
  const position = Math.max(1, sequence.findIndex(step => step.id === currentStep) + 1);
  return {
    position,
    total: Math.max(1, sequence.length),
    step_id: currentStep,
    label: sequence.find(step => step.id === currentStep)?.label ?? currentStep,
    status: nextPending ? "programado" : firstMissing ? "sin programar" : lastSent ? "enviado" : "pendiente",
    next_due_at: nextPending?.due_at ?? null,
    last_sent_at: lastSent?.sent_at ?? null,
    sent_count: sent.length,
  };
}

export function contactFunnelState(row: Pick<FunnelContact, "phase" | "suppressed" | "bounced_count" | "complained_count" | "converted">) {
  if (row.phase === 4 || row.converted) return "convertido";
  if (row.suppressed || row.phase === 5 || row.bounced_count > 0 || row.complained_count > 0) return "salida";
  if (row.phase === 0) return "lead";
  return "activo";
}

export function originLabel(row: Pick<FunnelContact, "sources" | "is_account" | "buyer">) {
  const sources = row.sources?.filter(Boolean) ?? [];
  if (sources.length) return sources.join(", ");
  if (row.is_account) return "cuenta";
  if (row.buyer) return "compra";
  return "sin origen";
}

export function enrichContact(row: FunnelContact, sequence: SequenceStep[]): FunnelContactRow {
  const seq = normalizeSequence(row.funnel_sequence ?? sequence);
  const jobs = Array.isArray(row.welcome_jobs) ? row.welcome_jobs : [];
  const current = currentEmailFor(seq, jobs);
  return {
    ...row,
    phase_label: phaseLabel(row.phase),
    funnel_state: contactFunnelState(row),
    current_email: current,
    origin: originLabel(row),
    campaign: "Sin atribución",
    revenue_cents: Math.max(0, Number(row.shop_revenue_cents) || 0) + Math.max(0, Number(row.subscription_revenue_cents) || 0),
  };
}

export type EmailBreakdownRow = {
  position: number;
  step_id: string;
  label: string;
  kind: StepKind;
  next_phase: number;
  people: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  ctr: number | null;
  lost_from_previous: number;
  loss_rate: number | null;
};

export function emailBreakdown(sequence: SequenceStep[], contacts: FunnelContact[]): EmailBreakdownRow[] {
  const rows = sequence.map((step, index) => {
    let people = 0, sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0, complained = 0;
    for (const contact of contacts) {
      const jobs = (contact.welcome_jobs ?? []).filter(job => job.step === step.id && job.status === "sent");
      if (!jobs.length) continue;
      people++;
      sent += jobs.length;
      for (const job of jobs) {
        const events = job.events ?? {};
        delivered += Number(events.delivered) || (job.delivered_at ? 1 : 0);
        opened += Number(events.opened) || 0;
        clicked += Number(events.clicked) || 0;
        bounced += Number(events.bounced) || 0;
        complained += Number(events.complained) || 0;
      }
    }
    return {
      position: index + 1,
      step_id: step.id,
      label: step.label,
      kind: step.kind,
      next_phase: kindPhase(step.kind),
      people,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      ctr: sent ? clicked / sent : null,
      lost_from_previous: 0,
      loss_rate: null as number | null,
    };
  });
  for (let index = 1; index < rows.length; index++) {
    const previous = rows[index - 1];
    const lost = Math.max(0, previous.people - rows[index].people);
    rows[index].lost_from_previous = lost;
    rows[index].loss_rate = previous.people ? lost / previous.people : null;
  }
  return rows;
}

export function largestDropoff(rows: EmailBreakdownRow[]) {
  return rows.slice(1)
    .filter(row => row.lost_from_previous > 0)
    .sort((a, b) => b.lost_from_previous - a.lost_from_previous || (b.loss_rate ?? 0) - (a.loss_rate ?? 0))[0] ?? null;
}

export function phaseSummary(contacts: FunnelContact[]) {
  const total = contacts.length;
  let previous = total;
  return PHASES.map(phase => {
    const people = contacts.filter(contact => contact.phase === phase.id).length;
    const share = total ? people / total : null;
    const sharePrevious = previous ? people / previous : null;
    const lost = Math.max(0, previous - people);
    previous = people;
    return { phase: phase.id, label: phase.label, people, share, share_previous: sharePrevious, lost };
  });
}

export function monthlyCents(plan: string, interval: string | null | undefined) {
  const annual = interval === "year";
  if (plan === "maestre_campo") return annual ? Math.round(3799 / 12) : 399;
  if (plan === "arcabucero") return annual ? Math.round(1799 / 12) : 199;
  return 0;
}

export function mrrCents(contacts: FunnelContact[]) {
  return contacts.reduce((sum, contact) => {
    if (!contact.active_paid) return sum;
    return sum + monthlyCents(contact.maestre ? "maestre_campo" : contact.arcabucero ? "arcabucero" : "", contact.subscription_interval);
  }, 0);
}

export function economySummary(contacts: FunnelContact[]) {
  const subscriptionRevenue = contacts.reduce((sum, contact) => sum + Math.max(0, Number(contact.subscription_revenue_cents) || 0), 0);
  const shopRevenue = contacts.reduce((sum, contact) => sum + Math.max(0, Number(contact.shop_revenue_cents) || 0), 0);
  return {
    mrr_cents: mrrCents(contacts),
    arr_cents: mrrCents(contacts) * 12,
    subscription_revenue_cents: subscriptionRevenue,
    shop_revenue_cents: shopRevenue,
    total_revenue_cents: subscriptionRevenue + shopRevenue,
    active_maestre: contacts.filter(contact => contact.maestre).length,
    active_arcabucero: contacts.filter(contact => contact.arcabucero).length,
    buyers: contacts.filter(contact => contact.buyer).length,
  };
}

export function percentage(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${(value * 100).toFixed(1)} %`;
}

export function money(cents: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((Number(cents) || 0) / 100);
}

export function validEmail(value: unknown) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type PeriodKey = "7d" | "30d" | "90d" | "month" | "prev_month" | "all" | "custom";

export type FunnelQuery = {
  period: PeriodKey;
  from: string | null;
  to: string | null;
  q: string;
  phase: number | null;
  step: string;
  active: boolean;
  inactive: boolean;
  converted: boolean;
  piquero: boolean;
  maestre: boolean;
  buyer: boolean;
  source: string;
  campaign: string;
  unsubscribe: boolean;
  error: boolean;
  page: number;
  pageSize: number;
  sort: "recent" | "oldest" | "revenue";
};

const PERIODS: PeriodKey[] = ["7d", "30d", "90d", "month", "prev_month", "all", "custom"];

function dateBoundary(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function parseFunnelQuery(params: URLSearchParams): FunnelQuery {
  const rawPeriod = params.get("period") ?? "30d";
  const period = PERIODS.includes(rawPeriod as PeriodKey) ? rawPeriod as PeriodKey : "30d";
  const q = (params.get("q") ?? "").trim().slice(0, 120);
  const rawPhase = params.get("phase");
  const phase = rawPhase === null || rawPhase === "" ? null : Number(rawPhase);
  if (phase !== null && (!Number.isInteger(phase) || phase < 0 || phase > 5)) throw Error("INVALID_INPUT");
  const page = Number(params.get("page") ?? 0);
  const pageSize = Number(params.get("pageSize") ?? 25);
  if (!Number.isInteger(page) || page < 0 || page > 100000) throw Error("INVALID_INPUT");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw Error("INVALID_INPUT");
  const sort = params.get("sort");
  const from = dateBoundary(params.get("from"));
  const to = dateBoundary(params.get("to"));
  if (period === "custom" && (!from || !to || from > to)) throw Error("INVALID_INPUT");
  const step = (params.get("step") ?? "").trim().slice(0, 80);
  return {
    period, from, to, q, phase, step,
    active: params.get("active") === "1",
    inactive: params.get("inactive") === "1",
    converted: params.get("converted") === "1",
    piquero: params.get("piquero") === "1",
    maestre: params.get("maestre") === "1",
    buyer: params.get("buyer") === "1",
    source: (params.get("source") ?? "").trim().slice(0, 60),
    campaign: (params.get("campaign") ?? "").trim().slice(0, 120),
    unsubscribe: params.get("unsubscribe") === "1",
    error: params.get("error") === "1",
    page, pageSize,
    sort: sort === "oldest" || sort === "revenue" ? sort : "recent",
  };
}

export function periodRange(query: Pick<FunnelQuery, "period" | "from" | "to">, now = new Date()) {
  if (query.period === "all") return { from: null, to: null, previousFrom: null, previousTo: null, days: null };
  if (query.period === "custom") {
    const start = new Date(`${query.from}T00:00:00Z`);
    const end = new Date(`${query.to}T23:59:59.999Z`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(start.getTime() - days * 86400000);
    return { from: start.toISOString(), to: end.toISOString(), previousFrom: previousStart.toISOString(), previousTo: previousEnd.toISOString(), days };
  }
  if (query.period === "month" || query.period === "prev_month") {
    const offset = query.period === "prev_month" ? -1 : 0;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1) - 1);
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset - 1, 1));
    const previousEnd = new Date(start.getTime() - 1);
    return { from: start.toISOString(), to: end.toISOString(), previousFrom: previousStart.toISOString(), previousTo: previousEnd.toISOString(), days: Math.round((end.getTime() - start.getTime()) / 86400000) };
  }
  const days = Number(query.period.slice(0, -1));
  const end = now;
  const start = new Date(end.getTime() - days * 86400000);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    previousFrom: new Date(start.getTime() - days * 86400000).toISOString(),
    previousTo: start.toISOString(),
    days,
  };
}

export function inRange(value: string | null | undefined, from: string | null, to: string | null) {
  if (!from && !to) return true;
  if (!value) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  if (from && time < Date.parse(from)) return false;
  if (to && time > Date.parse(to)) return false;
  return true;
}
