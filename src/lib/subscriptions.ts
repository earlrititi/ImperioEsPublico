export type FreePlanName = "piquero";
export type PaidPlanName = "arcabucero" | "maestre_campo";
export type ContentPaidTierName = "arcabucero" | "maestre-de-campo";
export type BillingInterval = "month" | "year";

export type SubscriptionRecord = {
  id: string;
  user_id: string | null;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PaidPlanName;
  billing_interval: BillingInterval | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("./supabase/admin");

  return supabaseAdmin;
}

export function normalizePaidPlan(plan: string | null | undefined) {
  if (plan === "maestre-de-campo") {
    return "maestre_campo";
  }

  if (plan === "arcabucero" || plan === "maestre_campo") {
    return plan;
  }

  return null;
}

export function isPaidPlan(plan: string | null | undefined) {
  return normalizePaidPlan(plan) !== null;
}

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function isActivePaidSubscription(params: {
  plan?: string | null;
  status?: string | null;
}) {
  return isPaidPlan(params.plan) && isActiveSubscriptionStatus(params.status);
}

export function canAccessArcabucero(params: {
  plan?: string | null;
  status?: string | null;
}) {
  const plan = normalizePaidPlan(params.plan);

  return (
    (plan === "arcabucero" || plan === "maestre_campo") &&
    isActiveSubscriptionStatus(params.status)
  );
}

export function canAccessMaestreCampo(params: {
  plan?: string | null;
  status?: string | null;
}) {
  return (
    normalizePaidPlan(params.plan) === "maestre_campo" &&
    isActiveSubscriptionStatus(params.status)
  );
}

export function canAccessContentTier(
  requiredTier: FreePlanName | ContentPaidTierName,
  params: {
    plan?: string | null;
    status?: string | null;
  }
) {
  if (requiredTier === "piquero") {
    return true;
  }

  if (requiredTier === "arcabucero") {
    return canAccessArcabucero(params);
  }

  return canAccessMaestreCampo(params);
}

export async function findUserIdByEmail(email: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("findUserIdByEmail error:", error);
    throw error;
  }

  return data?.id ?? null;
}

export async function upsertSubscription(params: {
  userId?: string | null;
  email?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId: string;
  plan: PaidPlanName;
  billingInterval?: BillingInterval | null;
  status: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
}) {
  const supabaseAdmin = await getSupabaseAdmin();
  const payload = {
    user_id: params.userId ?? null,
    email: params.email?.toLowerCase() ?? null,
    stripe_customer_id: params.stripeCustomerId ?? null,
    stripe_subscription_id: params.stripeSubscriptionId,
    plan: params.plan,
    billing_interval: params.billingInterval ?? "month",
    status: params.status,
    current_period_start: params.currentPeriodStart?.toISOString() ?? null,
    current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
    cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(payload, {
      onConflict: "stripe_subscription_id",
    })
    .select()
    .single<SubscriptionRecord>();

  if (error) {
    console.error("upsertSubscription error:", error);
    throw error;
  }

  return data;
}

export async function getSubscriptionByUserId(userId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRecord>();

  if (error) {
    console.error("getSubscriptionByUserId error:", error);
    throw error;
  }

  if (data) {
    return data;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string | null }>();

  if (profileError) {
    console.error("getSubscriptionByUserId profile lookup error:", profileError);
    throw profileError;
  }

  const email = profile?.email?.toLowerCase();

  if (!email) {
    return null;
  }

  const { data: unlinkedSubscription, error: unlinkedError } =
    await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("email", email)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRecord>();

  if (unlinkedError) {
    console.error(
      "getSubscriptionByUserId unlinked subscription lookup error:",
      unlinkedError
    );
    throw unlinkedError;
  }

  if (!unlinkedSubscription) {
    return null;
  }

  const { data: linkedSubscription, error: linkError } = await supabaseAdmin
    .from("subscriptions")
    .update({ user_id: userId })
    .eq("id", unlinkedSubscription.id)
    .is("user_id", null)
    .select("*")
    .maybeSingle<SubscriptionRecord>();

  if (linkError) {
    console.error("getSubscriptionByUserId link error:", linkError);
    throw linkError;
  }

  if (linkedSubscription) {
    return linkedSubscription;
  }

  const { data: concurrentlyLinked, error: concurrentError } =
    await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRecord>();

  if (concurrentError) {
    console.error(
      "getSubscriptionByUserId concurrent link lookup error:",
      concurrentError
    );
    throw concurrentError;
  }

  return concurrentlyLinked;
}
