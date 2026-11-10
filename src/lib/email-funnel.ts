import type { FunnelContact, SequenceStep } from "./email-funnel-model";
import {
  defaultSequence,
  emailBreakdown,
  enrichContact,
  largestDropoff,
  monthlyCents,
  normalizeSequence,
  parseFunnelQuery,
  periodRange,
  phaseSummary,
  validEmail,
  type EmailBreakdownRow,
  type FunnelContactRow,
  type FunnelQuery,
} from "./email-funnel-model";
import { database } from "./reservations";

type DB = Awaited<ReturnType<typeof database>>;
type AnyRow = Record<string, any>;

const CONTACT_COLUMNS = [
  "email", "name", "captured_at", "sources", "audience_state", "suppressed", "suppression_reason",
  "preference", "verified_at", "welcome_at", "welcome_jobs", "funnel_sequence", "sent_count", "pending_count",
  "delivered_count", "opened_count", "clicked_count", "bounced_count", "complained_count", "failed_count",
  "last_sent_at", "next_due_at", "last_opened_at", "last_clicked_at", "phase", "converted", "active_paid",
  "maestre", "arcabucero", "buyer", "is_account", "order_count", "shop_revenue_cents",
  "subscription_revenue_cents", "subscription_interval", "subscribed_at", "renews_at", "last_order_at",
  "last_payment_at", "last_checkout_at",
].join(",");

function migrationError(error: any) {
  const message = String(error?.message ?? "");
  return error?.code === "42P01" || /admin_email_funnel_contacts|schema cache|does not exist/i.test(message);
}

function dbFailure(error: any) {
  if (migrationError(error)) throw Error("EMAIL_FUNNEL_MIGRATION_REQUIRED");
  throw Error("DATABASE_UNAVAILABLE");
}

async function readSequence(db: DB): Promise<SequenceStep[]> {
  try {
    const result = await db.from("marketing_automation_drafts").select("steps").eq("key", "welcome").maybeSingle();
    if (!result.error && result.data?.steps) return normalizeSequence(result.data.steps);
  } catch {
    // Defaults below are only a fallback; the dashboard never invents sends.
  }
  return defaultSequence();
}

async function readScope(db: DB, from: string | null, to: string | null, source: string): Promise<FunnelContact[]> {
  const rows: FunnelContact[] = [];
  for (let page = 0; page < 200; page++) {
    let query: any = db.from("admin_email_funnel_contacts").select(CONTACT_COLUMNS);
    if (from) query = query.gte("captured_at", from);
    if (to) query = query.lte("captured_at", to);
    if (source) query = query.contains("sources", [source]);
    const result = await query.order("email").range(page * 1000, page * 1000 + 999);
    if (result.error) dbFailure(result.error);
    const data = (result.data ?? []) as FunnelContact[];
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
  throw Error("AUDIENCE_TOO_LARGE");
}

async function readEconomy(db: DB, from: string | null, to: string | null) {
  const empty = {
    mrr_cents: 0, arr_cents: 0, subscription_revenue_cents: 0, shop_revenue_cents: 0, total_revenue_cents: 0,
    active_maestre: 0, active_arcabucero: 0, revenue_available: false,
  };
  try {
    const orders: AnyRow[] = [];
    for (let page = 0; page < 100; page++) {
      let query: any = db.from("commerce_orders").select("total,refunded_amount,status,paid_at");
      if (from) query = query.gte("paid_at", from);
      if (to) query = query.lte("paid_at", to);
      const result = await query.range(page * 1000, page * 1000 + 999);
      if (result.error) return empty;
      orders.push(...(result.data ?? []));
      if ((result.data ?? []).length < 1000) break;
    }
    const invoices: AnyRow[] = [];
    for (let page = 0; page < 100; page++) {
      let query: any = db.from("stripe_webhook_events").select("event_id,amount_paid,occurred_at,event_type,invoice_id")
        .in("event_type", ["invoice.paid", "invoice.payment_succeeded"]);
      if (from) query = query.gte("occurred_at", from);
      if (to) query = query.lte("occurred_at", to);
      const result = await query.range(page * 1000, page * 1000 + 999);
      if (result.error) return empty;
      invoices.push(...(result.data ?? []));
      if ((result.data ?? []).length < 1000) break;
    }
    // Both invoice events can describe the same charge: keep one row per invoice.
    const uniqueInvoices = new Map<string, AnyRow>();
    for (const invoice of invoices) {
      const key = String(invoice.invoice_id ?? invoice.event_id ?? "");
      if (!key) continue;
      const previous = uniqueInvoices.get(key);
      const currentTime = Date.parse(String(invoice.occurred_at ?? ""));
      const previousTime = Date.parse(String(previous?.occurred_at ?? ""));
      const currentHasAmount = invoice.amount_paid !== null && invoice.amount_paid !== undefined;
      const previousHasAmount = previous?.amount_paid !== null && previous?.amount_paid !== undefined;
      if (!previous || (currentHasAmount && !previousHasAmount) || (currentHasAmount === previousHasAmount && currentTime > previousTime)) {
        uniqueInvoices.set(key, invoice);
      }
    }
    const subscriptions: AnyRow[] = [];
    for (let page = 0; page < 100; page++) {
      const result = await db.from("subscriptions").select("plan,billing_interval,status")
        .in("status", ["active", "trialing"]).range(page * 1000, page * 1000 + 999);
      if (result.error) return empty;
      subscriptions.push(...(result.data ?? []));
      if ((result.data ?? []).length < 1000) break;
    }
    const shopRevenue = orders
      .filter(order => !["CANCELLED", "REFUNDED"].includes(String(order.status)))
      .reduce((sum, order) => sum + Math.max(0, Number(order.total) - Number(order.refunded_amount)), 0);
    const subscriptionRevenue = [...uniqueInvoices.values()].reduce((sum, row) => sum + Math.max(0, Number(row.amount_paid) || 0), 0);
    const mrr = subscriptions.reduce((sum, row) => sum + monthlyCents(String(row.plan), row.billing_interval), 0);
    return {
      mrr_cents: mrr,
      arr_cents: mrr * 12,
      subscription_revenue_cents: subscriptionRevenue,
      shop_revenue_cents: shopRevenue,
      total_revenue_cents: subscriptionRevenue + shopRevenue,
      active_maestre: subscriptions.filter(row => row.plan === "maestre_campo").length,
      active_arcabucero: subscriptions.filter(row => row.plan === "arcabucero").length,
      revenue_available: true,
    };
  } catch {
    return empty;
  }
}

function compareRows(rows: FunnelContactRow[], query: FunnelQuery) {
  const search = query.q.toLowerCase();
  return rows.filter(row => {
    if (search && !`${row.email} ${row.name ?? ""}`.toLowerCase().includes(search)) return false;
    if (query.phase !== null && row.phase !== query.phase) return false;
    const isActive = !row.suppressed && row.phase !== 5 && row.phase !== 4;
    if (query.active && !isActive) return false;
    if (query.inactive && isActive) return false;
    if (query.converted && !row.converted) return false;
    if (query.piquero && !(row.is_account && !row.active_paid)) return false;
    if (query.maestre && !row.maestre) return false;
    if (query.buyer && !row.buyer) return false;
    if (query.step && row.current_email.step_id !== query.step) return false;
    if (query.campaign && !row.campaign.toLowerCase().includes(query.campaign.toLowerCase())) return false;
    if (query.unsubscribe && !isUnsubscribed(row)) return false;
    if (query.error && !hasError(row)) return false;
    return true;
  });
}

function isUnsubscribed(row: FunnelContact) {
  return Boolean(row.suppressed) && (
    row.suppression_reason === "unsubscribe" ||
    row.audience_state === "unsubscribed" ||
    row.preference === false
  );
}

function hasError(row: FunnelContact) {
  return Number(row.bounced_count) > 0 || Number(row.complained_count) > 0 ||
    row.suppression_reason === "provider_bounced" || row.suppression_reason === "provider_complained";
}

function sortRows(rows: FunnelContactRow[], sort: FunnelQuery["sort"]) {
  return [...rows].sort((a, b) => {
    if (sort === "revenue") return b.revenue_cents - a.revenue_cents || b.captured_at.localeCompare(a.captured_at);
    const comparison = a.captured_at.localeCompare(b.captured_at);
    return sort === "oldest" ? comparison : -comparison;
  });
}

function dateKey(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(date);
}

function upcomingSends(contacts: FunnelContact[], sequence: SequenceStep[]) {
  const labels = new Map(sequence.map(step => [step.id, step]));
  const now = Date.now();
  const items: AnyRow[] = [];
  let blocked = 0;
  let errors = 0;
  for (const contact of contacts) {
    for (const job of contact.welcome_jobs ?? []) {
      const pending = ["pending", "processing"].includes(job.status);
      const failed = ["review", "failed"].includes(job.status) || Boolean(job.reason);
      if (!pending && !failed) continue;
      const due = job.due_at ? Date.parse(job.due_at) : NaN;
      const late = pending && Number.isFinite(due) && due < now;
      if (pending && Number.isFinite(due) && due < now - 48 * 3600000) blocked++;
      if (failed) errors++;
      items.push({
        email: contact.email,
        name: contact.name ?? "",
        step: job.step,
        step_label: labels.get(job.step)?.label ?? job.step,
        status: job.status,
        reason: job.reason ?? "",
        error: failed,
        due_at: job.due_at,
        late,
        phase: contact.phase,
      });
    }
  }
  items.sort((a, b) => Number(b.error) - Number(a.error) || String(a.due_at ?? "").localeCompare(String(b.due_at ?? "")));
  const today = dateKey(now);
  const tomorrow = dateKey(now + 86400000);
  const pendingItems = items.filter(item => !item.error);
  return {
    items: items.slice(0, 60),
    total: items.length,
    today: pendingItems.filter(item => dateKey(item.due_at) === today).length,
    tomorrow: pendingItems.filter(item => dateKey(item.due_at) === tomorrow).length,
    overdue: pendingItems.filter(item => item.late).length,
    blocked_48h: blocked,
    errors,
  };
}

export async function readEmailFunnel(params: URLSearchParams, db?: DB) {
  const query = parseFunnelQuery(params);
  const range = periodRange(query);
  const client = db ?? await database();
  const [sequence, contacts] = await Promise.all([
    readSequence(client),
    readScope(client, range.from, range.to, query.source),
  ]);
  const enriched = contacts.map(row => enrichContact(row, sequence));
  const tableRows = sortRows(compareRows(enriched, query), query.sort);
  const total = tableRows.length;
  const start = query.page * query.pageSize;
  const pageItems = tableRows.slice(start, start + query.pageSize);

  const economy = await readEconomy(client, range.from, range.to);
  let previous: AnyRow | null = null;
  if (range.previousFrom && range.previousTo) {
    const previousContacts = await readScope(client, range.previousFrom, range.previousTo, query.source);
    const previousEconomy = await readEconomy(client, range.previousFrom, range.previousTo);
    previous = {
      entered: previousContacts.length,
      converted: previousContacts.filter(row => row.phase === 4).length,
      conversion_rate: previousContacts.length ? previousContacts.filter(row => row.phase === 4).length / previousContacts.length : null,
      total_revenue_cents: previousEconomy.total_revenue_cents,
      shop_revenue_cents: previousEconomy.shop_revenue_cents,
      subscription_revenue_cents: previousEconomy.subscription_revenue_cents,
    };
  }

  const sent = enriched.reduce((sum, row) => sum + Number(row.sent_count || 0), 0);
  const delivered = enriched.reduce((sum, row) => sum + Number(row.delivered_count || 0), 0);
  const opened = enriched.reduce((sum, row) => sum + Number(row.opened_count || 0), 0);
  const clicked = enriched.reduce((sum, row) => sum + Number(row.clicked_count || 0), 0);
  const bounced = enriched.reduce((sum, row) => sum + Number(row.bounced_count || 0), 0);
  const complained = enriched.reduce((sum, row) => sum + Number(row.complained_count || 0), 0);
  const converted = enriched.filter(row => row.converted).length;
  const unsubscribed = enriched.filter(isUnsubscribed).length;
  const errors = enriched.filter(hasError).length;
  const active = enriched.filter(row => !row.suppressed && row.phase !== 5 && row.phase !== 4).length;
  const pendingNext = enriched.filter(row => Number(row.pending_count) > 0).length;
  const breakdown = emailBreakdown(sequence, enriched);
  const dropoff = largestDropoff(breakdown);
  const phases = phaseSummary(enriched);
  const sources = [...new Set(enriched.flatMap(row => row.sources ?? []).filter(Boolean))].sort();

  return {
    generated_at: new Date().toISOString(),
    period: query.period,
    range: { from: range.from, to: range.to, days: range.days, previous_from: range.previousFrom, previous_to: range.previousTo },
    sequence,
    kpis: {
      entered: enriched.length,
      active,
      pending_next: pendingNext,
      converted,
      conversion_rate: enriched.length ? converted / enriched.length : null,
      unsubscribed,
      errors,
      piquero: enriched.filter(row => row.is_account && !row.active_paid).length,
      maestre: enriched.filter(row => row.maestre).length,
      arcabucero: enriched.filter(row => row.arcabucero).length,
      buyers: enriched.filter(row => row.buyer).length,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
    },
    email_health: {
      sent,
      delivered,
      opened,
      clicked,
      open_rate: sent ? opened / sent : null,
      click_rate: sent ? clicked / sent : null,
      delivery_rate: sent ? delivered / sent : null,
      bounce_rate: sent ? bounced / sent : null,
      complaint_rate: sent ? complained / sent : null,
    },
    phases,
    dropoff,
    breakdown,
    upcoming: upcomingSends(enriched, sequence),
    economy,
    previous,
    contacts: {
      items: pageItems,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    options: {
      sources,
      phases: phases.map(phase => ({ value: phase.phase, label: phase.label })),
      steps: sequence.map(step => ({ value: step.id, label: step.label, kind: step.kind })),
    },
    limitations: [
      "Las aperturas y clics son señales parciales del proveedor (Apple Mail Privacy Protection y proxies pueden inflarlas). Los clics y, sobre todo, las conversiones de Stripe son la referencia.",
      "El historial de eventos de Resend empieza cuando se activa el webhook. Las aperturas y clics anteriores no se pueden reconstruir.",
      "La secuencia se lee de marketing_automation_drafts. La restricción actual permite entre 1 y 5 emails por secuencia.",
      "Los formularios no guardan UTM. La columna Campaña/UTM muestra «Sin atribución» si la fuente no la contiene.",
      "Stripe es la única fuente económica. El ingreso por suscripciones se suma al ledger de eventos verificados desde la activación de esta migración; el histórico anterior puede ser incompleto.",
      "subscription_checkouts conserva solo el último intento por email, no el historial completo de checkouts.",
      "Un contacto se considera convertido con una suscripción de pago activa o un pedido de tienda no cancelado. La atribución se hace por email normalizado.",
    ],
  };
}

export async function readEmailFunnelContact(emailValue: string, db?: DB) {
  const email = (emailValue ?? "").trim().toLowerCase();
  if (!validEmail(email)) throw Error("INVALID_INPUT");
  const client = db ?? await database();
  const sequence = await readSequence(client);
  const contactResult = await client.from("admin_email_funnel_contacts").select(CONTACT_COLUMNS).eq("email", email).maybeSingle();
  if (contactResult.error) dbFailure(contactResult.error);
  if (!contactResult.data) throw Error("NOT_FOUND");
  const row = contactResult.data as unknown as FunnelContact;
  const contact = enrichContact(row, sequence);
  const [events, orders, subscriptions, checkouts, logs] = await Promise.all([
    client.from("email_provider_events").select("event_type,occurred_at,url,detail")
      .eq("email", email).order("occurred_at", { ascending: false }).limit(200),
    client.from("commerce_orders").select("number,status,total,refunded_amount,currency,paid_at,created_at")
      .eq("customer_email", email).order("paid_at", { ascending: false }).limit(50),
    client.from("subscriptions").select("plan,status,billing_interval,current_period_start,current_period_end,created_at")
      .eq("email", email).order("created_at", { ascending: false }).limit(20),
    client.from("subscription_checkouts").select("plan,created_at,expires_at").eq("email", email).maybeSingle(),
    client.from("email_logs").select("subject,type,status,delivery_status,sent_at,created_at")
      .eq("recipient", email).order("created_at", { ascending: false }).limit(50),
  ]);
  const timeline: AnyRow[] = [];
  const push = (at: unknown, kind: string, label: string, detail: AnyRow = {}) => {
    if (typeof at !== "string" || !Number.isFinite(Date.parse(at))) return;
    timeline.push({ at, kind, label, ...detail });
  };
  push(contact.captured_at, "lead", "Lead captado", { source: contact.origin });
  push(contact.verified_at, "verification", "Email verificado");
  for (const job of contact.welcome_jobs ?? []) {
    const step = sequence.find(item => item.id === job.step);
    const label = step?.label ?? job.step;
    push(job.sent_at, "email_sent", `Email enviado: ${label}`, { status: job.delivery_status ?? job.status, step: job.step });
    push(job.delivered_at, "email_delivered", `Entrega confirmada: ${label}`, { step: job.step });
    if (job.status === "pending" || job.status === "processing") push(job.due_at, "email_scheduled", `Email programado: ${label}`, { status: job.status, step: job.step });
    if (job.reason) push(job.sent_at ?? job.due_at, "email_incident", `Incidencia: ${job.reason}`, { step: job.step });
  }
  for (const event of events.data ?? []) {
    const labels: Record<string, string> = {
      sent: "Aceptado por el proveedor",
      delivered: "Entrega confirmada por el proveedor",
      delivery_delayed: "Entrega retrasada",
      opened: "Apertura registrada (señal parcial)",
      clicked: "Clic registrado",
      bounced: "Rebote del proveedor",
      complained: "Queja de spam",
      failed: "Fallo del proveedor",
      suppressed: "Suprimido por el proveedor",
    };
    push(event.occurred_at, `provider_${event.event_type}`, labels[event.event_type] ?? event.event_type, {
      url: event.url ?? undefined,
      bounce: event.detail?.bounce_type ?? undefined,
    });
  }
  push(contact.last_checkout_at, "checkout", "Checkout de suscripción iniciado", {
    plan: (checkouts.data as AnyRow | null)?.plan ?? undefined,
  });
  for (const subscription of subscriptions.data ?? []) {
    push(subscription.created_at, "stripe_subscription", `Suscripción Stripe: ${subscription.plan}`, {
      status: subscription.status,
      interval: subscription.billing_interval,
      period_end: subscription.current_period_end,
    });
  }
  push(contact.last_payment_at, "stripe_payment", "Pago de suscripción confirmado en Stripe");
  for (const order of orders.data ?? []) {
    push(order.paid_at ?? order.created_at, "stripe_order", `Pedido confirmado: ${order.number}`, {
      status: order.status,
      amount_cents: Math.max(0, Number(order.total) - Number(order.refunded_amount)),
    });
  }
  for (const log of logs.data ?? []) {
    push(log.sent_at ?? log.created_at, "mail_log", `Correo: ${log.subject}`, {
      status: log.delivery_status ?? log.status,
      type: log.type,
    });
  }
  timeline.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    contact,
    timeline: timeline.slice(0, 250),
    provider_events: (events.data ?? []).map(event => ({
      event_type: event.event_type,
      occurred_at: event.occurred_at,
      url: event.url ?? null,
      bounce_type: event.detail?.bounce_type ?? null,
    })),
    orders: orders.data ?? [],
    subscriptions: subscriptions.data ?? [],
    checkout: checkouts.data ?? null,
    mail_logs: logs.data ?? [],
    generated_at: new Date().toISOString(),
  };
}

export type { EmailBreakdownRow };
