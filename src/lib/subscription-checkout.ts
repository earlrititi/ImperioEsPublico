import type Stripe from "stripe";
import { database, rpc } from "./reservations";

export function blocksNewSubscription(status: string) {
  return ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"].includes(status);
}

export async function findBillingCustomer(stripe: Stripe, email: string, live: boolean) {
  let customerId: string | undefined;
  // Email may have multiple historical Stripe customers. Check every one, not just the first.
  for await (const customer of stripe.customers.list({ email, limit: 100 })) {
    if (customer.livemode !== live) throw new Error("BILLING_MODE_MISMATCH");
    customerId ??= customer.id;
    for await (const subscription of stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 })) {
      if (blocksNewSubscription(subscription.status)) throw new Error("SUBSCRIPTION_ALREADY_EXISTS");
    }
  }
  return customerId;
}

export async function guardedSubscriptionCheckout(
  stripe: Stripe, email: string, plan: string, userId: string | null,
  parameters: Stripe.Checkout.SessionCreateParams,
) {
  const db = await database();
  const previous = await db.from("subscription_checkouts").select("attempt_id,stripe_session_id,user_id")
    .eq("email", email).maybeSingle();
  if (previous.error) throw new Error("DATABASE_UNAVAILABLE");
  if (previous.data?.stripe_session_id && previous.data.user_id === userId) {
    const old = await stripe.checkout.sessions.retrieve(previous.data.stripe_session_id);
    if (old.status === "expired") {
      // Only a confirmed expired Stripe session can release the guard early.
      const released = await db.from("subscription_checkouts")
        .update({ expires_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() })
        .eq("email", email).eq("attempt_id", previous.data.attempt_id);
      if (released.error) throw new Error("DATABASE_UNAVAILABLE");
    }
  }
  const claim = await rpc("claim_subscription_checkout", {
    p_email: email, p_plan: plan, p_user: userId, p_parameters: parameters,
  });
  let session: Stripe.Checkout.Session;
  if (claim.stripe_session_id) {
    session = await stripe.checkout.sessions.retrieve(claim.stripe_session_id);
  } else {
    // Unknown create outcomes retry the exact persisted parameters and idempotency key.
    // Never create a late session whose minimum Stripe lifetime exceeds the database guard.
    if (new Date(claim.expires_at).getTime() - Date.now() < 31 * 60 * 1000)
      throw new Error("CHECKOUT_RETRY_LATER");
    session = await stripe.checkout.sessions.create(claim.parameters, {
      idempotencyKey: `subscription-checkout-${claim.attempt_id}`,
    });
    const { error } = await (await database()).from("subscription_checkouts")
      .update({ stripe_session_id: session.id }).eq("email", email).eq("attempt_id", claim.attempt_id);
    if (error) throw new Error("DATABASE_UNAVAILABLE");
  }
  if (session.status !== "open" || !session.url) throw new Error("CHECKOUT_NOT_OPEN");
  return session;
}
