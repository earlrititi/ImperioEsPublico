import type Stripe from "stripe";
import { readAll } from "./admin-data";
import { getRequiredEnv } from "./env";

export async function verifiedSubscriptions() {
  const { stripe } = await import("./stripe");
  const rows = await readAll("subscriptions", "id,user_id,email,plan,status,stripe_subscription_id,billing_interval,created_at");
  const live = /^(sk|rk)_live_/.test(getRequiredEnv("STRIPE_SECRET_KEY"));
  const verified: Record<string, any>[] = [];
  const unresolved: Record<string, any>[] = [];
  for (const row of rows) {
    if (!row.stripe_subscription_id) {
      unresolved.push({ ...row, reason: "missing_stripe_id" });
      continue;
    }
    let subscription: Stripe.Subscription;
    try { subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id); }
    catch (error) {
      if ((error as { code?: string }).code !== "resource_missing") throw error;
      unresolved.push({ ...row, reason: "not_in_current_stripe_account" });
      continue;
    }
    if (subscription.livemode !== live) throw new Error("BILLING_MODE_MISMATCH");
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || !customer.email || customer.email.trim().toLowerCase() !== row.email?.trim().toLowerCase()) {
      unresolved.push({ ...row, reason: "customer_email_mismatch" });
      continue;
    }
    const plan = subscription.metadata.plan;
    if (plan !== "arcabucero" && plan !== "maestre_campo") {
      unresolved.push({ ...row, reason: "unknown_plan" });
      continue;
    }
    verified.push({ ...row, plan, status: subscription.status });
  }
  const active = verified.filter(s => s.status === "active");
  const duplicateEmails = [...new Set(active.map(s => s.email))].filter(email => active.filter(s => s.email === email).length > 1);
  return { verified, unresolved, duplicateEmails };
}
