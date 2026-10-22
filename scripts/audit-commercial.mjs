import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { summarizeFunnel } from "../src/lib/funnel.ts";

const env = parseEnv(readFileSync(".env.reservation-production.local", "utf8"));
assert.equal(env.PUBLIC_SUPABASE_URL, "https://pjrqozlyrjgugdraoght.supabase.co");
if (!/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "")) throw Error("LIVE_CREDENTIAL_REQUIRED");
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const asOf = Date.now();
const cutoff = asOf - 30 * 86400000;
const countBy = (rows, key) => rows.reduce((counts, row) => {
  const value = typeof key === "function" ? key(row) : row[key];
  counts[value ?? "unknown"] = (counts[value ?? "unknown"] ?? 0) + 1;
  return counts;
}, {});
const period = (rows, since, date = "created") => rows.filter(row => {
  const raw = row[date];
  const time = typeof raw === "number" ? raw * 1000 : Date.parse(raw);
  return time >= since && time <= asOf;
});
const sumsByCurrency = (rows, field) => rows.reduce((sums, row) => {
  sums[row.currency] = (sums[row.currency] ?? 0) + (row[field] ?? 0);
  return sums;
}, {});
async function collect(list) {
  const rows = [];
  for await (const row of list) {
    rows.push(row);
    if (rows.length >= 50000) throw Error("AUDIT_LIMIT_REACHED");
  }
  return rows;
}
async function select(table, columns, order = "created_at") {
  const rows = [];
  for (let offset = 0; offset < 50000; offset += 500) {
    const { data, error } = await db.from(table).select(columns).order(order).range(offset, offset + 499);
    if (error) throw Error(`SELECT_FAILED:${table}:${error.code}`);
    rows.push(...data);
    if (data.length < 500) return rows;
  }
  throw Error(`AUDIT_LIMIT_REACHED:${table}`);
}
const account = await stripe.accounts.retrieve();
assert.equal(account.id, "acct_1UCc4cDRITvLIOKF");
const sessions = await collect(stripe.checkout.sessions.list({ limit: 100 }));
const intents = await collect(stripe.paymentIntents.list({ limit: 100 }));
const charges = await collect(stripe.charges.list({ limit: 100 }));
const subscriptions = await collect(stripe.subscriptions.list({ limit: 100, status: "all" }));
const endpoints = await collect(stripe.webhookEndpoints.list({ limit: 100 }));
const prices = await collect(stripe.prices.list({ limit: 100, active: true }));
const fixture = row => row.metadata?.readiness_check || row.metadata?.test_only === "true";
const realSessions = sessions.filter(row => !fixture(row));
const reservations = await select("reservations", "created_at,status,total_quantity,total_price_snapshot,stripe_checkout_session_id,order_id");
const attempts = await select("reservation_payment_attempts", "created_at,status,stripe_session_id");
const orders = await select("commerce_orders", "id,created_at,status,total_quantity,total,currency,refunded_amount,stripe_checkout_session_id,stripe_payment_intent_id");
const variants = await select("product_variants", "sku,physical_stock,reserved_stock,sold_stock,available_stock,active", "sku");
const runs = await select("funnel_runs", "created_at,last_seen_at,flow,stages,page");
const interactions = await select("site_interactions", "hour,page,event,target,count", "hour");
const profiles = await select("profiles", "created_at,free_plan");
const ledger = (await select("stripe_webhook_events", "received_at,status,event_type", "received_at"))
  .map(row => ({ ...row, created_at: row.received_at }));
const outbox = await select("commerce_outbox", "created_at,status,kind");
const publicSubs = await select("subscriptions", "created_at,status,user_id,stripe_subscription_id");
const ownerNotices = await select("paid_order_admin_outbox", "order_id,status,delivery_status", "order_id");
const automationJobs = await select("marketing_automation_jobs", "created_at,key,status,delivery_status");
const automationRuntime = await db.from("marketing_automation_runtime").select("enabled,approved_at,enrollment_starts_at").eq("id", true).single();
if (automationRuntime.error) throw Error(`SELECT_FAILED:marketing_automation_runtime:${automationRuntime.error.code}`);
const eligible = await db.from("marketing_automation_enrolled_subjects").select("user_id", { head: true, count: "exact" });
if (eligible.error) throw Error(`SELECT_FAILED:marketing_automation_enrolled_subjects:${eligible.error.code}`);
const paidSessionIds = new Set(realSessions.filter(s => s.mode === "payment" && s.payment_status === "paid").map(s => s.id));
const orderSessionIds = new Set(orders.map(o => o.stripe_checkout_session_id));
const reportPeriod = since => {
  const checkout = period(realSessions, since);
  const payments = period(intents, since);
  const successful = period(charges, since).filter(c => c.paid && c.status === "succeeded");
  const paidOrders = period(orders, since, "created_at");
  const flows = period(runs, since, "created_at");
  return {
    stripe: {
      sessions: countBy(checkout, s => `${s.mode}:${s.status}:${s.payment_status}`),
      expiredUnpaid: checkout.filter(s => s.status === "expired" && s.payment_status === "unpaid").length,
      openUnpaid: checkout.filter(s => s.status === "open" && s.payment_status === "unpaid").length,
      paidCheckouts: countBy(checkout.filter(s => s.payment_status === "paid"), "mode"),
      paymentIntents: countBy(payments, "status"),
      intentsWithLastPaymentError: payments.filter(p => p.last_payment_error).length,
      successfulCharges: successful.length,
      collectedCents: sumsByCurrency(successful, "amount"),
      refundedFromTheseChargesCents: sumsByCurrency(successful, "amount_refunded"),
      averageChargeCents: successful.length ? Object.fromEntries(Object.entries(sumsByCurrency(successful, "amount"))
        .map(([currency, amount]) => [currency, Math.round(amount / successful.filter(c => c.currency === currency).length)])) : {},
    },
    supabase: {
      reservations: countBy(period(reservations, since, "created_at"), "status"),
      paymentAttempts: countBy(period(attempts, since, "created_at"), "status"),
      orders: countBy(paidOrders, "status"),
      orderedUnits: paidOrders.reduce((n, o) => n + o.total_quantity, 0),
      orderTotalsCents: sumsByCurrency(paidOrders, "total"),
      registrations: countBy(period(profiles, since, "created_at"), "free_plan"),
      webhookEvents: countBy(period(ledger, since, "created_at"), "status"),
      transactionalOutbox: countBy(period(outbox, since, "created_at"), o => `${o.kind}:${o.status}`),
    },
    measuredFunnel: Object.fromEntries(summarizeFunnel(flows, asOf).map(summary => [summary.flow, {
      runs: flows.filter(r => r.flow === summary.flow).length,
      inProgress: summary.inProgress,
      incompletePaths: summary.incompletePaths,
      largestObservedLoss: summary.largest,
      stagesObserved: summary.stages.map((stage, step) => ({ step, label: stage.label,
        observed: flows.filter(r => r.flow === summary.flow && r.stages.includes(step)).length,
        reachedWithPreviousSteps: stage.count, settled: stage.settled, lost: stage.lost, lossRate: stage.lossRate,
      })),
    }])),
    measuredPageViews: interactions.filter(r => Date.parse(r.hour) >= since && r.event === "page_view")
      .reduce((totals, row) => { totals[row.page] = (totals[row.page] ?? 0) + Number(row.count); return totals; }, {}),
  };
};
const activeSubs = subscriptions.filter(s => ["active", "trialing", "past_due", "unpaid"].includes(s.status));
const activeByUser = countBy(activeSubs, s => s.metadata?.supabaseUserId || s.metadata?.userId || s.customer);
const report = {
  asOf: new Date(asOf).toISOString(),
  limits: ["Consent-based analytics are partial, not all visitors.", "No historic cart events can be inferred when no cart existed.",
    "Expired unpaid sessions are unfinished checkouts, not necessarily failed card payments.",
    "Observed funnel stages cannot be joined to financial records without a measured lawful correlation.",
    "Environment snapshot values are local file contents, not a live Vercel configuration audit."],
  configuration: { account: account.id, chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled,
    paymentsMode: "live", localEnvironmentSnapshot: { source: ".env.reservation-production.local",
      googleTagId: env.PUBLIC_GOOGLE_TAG_ID || null, gtmId: env.PUBLIC_GTM_ID || null,
      flags: Object.fromEntries(["RESERVATION_MODE", "SHIRT_SALES_APPROVED", "STRIPE_LIVE_CHECKOUT_ENABLED"].map(k => [k, env[k] ?? null])) },
    webhooks: endpoints.map(w => ({ url: w.url, status: w.status, events: w.enabled_events })),
    prices: prices.map(p => ({ id: p.id, amount: p.unit_amount, currency: p.currency, interval: p.recurring?.interval ?? null, taxBehavior: p.tax_behavior })),
  },
  history: { firstCheckout: realSessions.length ? new Date(Math.min(...realSessions.map(s => s.created)) * 1000).toISOString() : null,
    firstMeasuredInteraction: interactions[0]?.hour ?? null, firstMeasuredFunnel: runs[0]?.created_at ?? null,
    excludedExplicitTestSessions: sessions.length - realSessions.length },
  last30Days: reportPeriod(cutoff), allTime: reportPeriod(0), inventory: variants,
  notifications: {
    ownerPaidOrders: { total: ownerNotices.length, accepted: ownerNotices.filter(row => row.status === "SENT").length,
      delivered: ownerNotices.filter(row => row.delivery_status === "delivered").length,
      pendingOrFailed: ownerNotices.filter(row => row.status !== "SENT").length,
      paidOrdersWithoutNotice: orders.filter(order => !ownerNotices.some(notice => notice.order_id === order.id)).length },
    marketing: { databaseApproval: automationRuntime.data, eligibleAccounts: eligible.count,
      jobs: countBy(automationJobs, row => `${row.key}:${row.status}:${row.delivery_status ?? "not_sent"}`),
      limit: "Database approval is not proof of current server flags, template approval or actual delivery." },
  },
  reconciliation: {
    paidShirtSessionsWithoutOrder: [...paidSessionIds].filter(id => !orderSessionIds.has(id)).length,
    ordersWithoutPaidStripeSession: orders.filter(o => !paidSessionIds.has(o.stripe_checkout_session_id)).length,
    duplicatedActiveStripeSubscriptionOwners: Object.values(activeByUser).filter(n => n > 1).length,
    stripeSubscriptionStatuses: countBy(subscriptions, "status"), supabaseSubscriptionStatuses: countBy(publicSubs, "status"),
    negativeInventory: variants.filter(v => v.available_stock < 0 || v.physical_stock < v.reserved_stock + v.sold_stock).length,
  },
};
mkdirSync("tmp/commercial-audit", { recursive: true });
const path = `tmp/commercial-audit/${report.asOf.slice(0, 10)}.json`;
writeFileSync(path, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ path, configuration: report.configuration, history: report.history,
  last30Days: report.last30Days, allTime: report.allTime, reconciliation: report.reconciliation, notifications: report.notifications }, null, 2));
