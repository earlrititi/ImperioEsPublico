async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("./supabase/admin");
  return supabaseAdmin;
}

export async function claimStripeEvent(params: {
  eventId: string;
  eventType: string;
}) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { error: insertError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      event_id: params.eventId,
      event_type: params.eventType,
      status: "processing",
    });

  if (!insertError) {
    return true;
  }

  if (insertError.code !== "23505") {
    throw insertError;
  }

  const { data: existing, error: selectError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("status, attempts, received_at")
    .eq("event_id", params.eventId)
    .single<{
      status: "processing" | "completed" | "failed";
      attempts: number;
      received_at: string;
    }>();

  if (selectError) {
    throw selectError;
  }

  if (existing.status === "completed") {
    return false;
  }

  const isStaleProcessing =
    existing.status === "processing" &&
    Date.now() - new Date(existing.received_at).getTime() > 5 * 60 * 1000;

  if (existing.status === "processing" && !isStaleProcessing) {
    throw new Error("STRIPE_EVENT_PROCESSING");
  }

  const { data: reclaimed, error: updateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "processing",
      attempts: existing.attempts + 1,
      last_error: null,
      received_at: new Date().toISOString(),
    })
    .eq("event_id", params.eventId)
    .eq("status", existing.status)
    .eq("received_at", existing.received_at)
    .select("event_id")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!reclaimed) throw new Error("STRIPE_EVENT_CLAIM_CONFLICT");
  return true;
}

export async function completeStripeEvent(eventId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("event_id", eventId);

  if (error) {
    throw error;
  }
}

export async function failStripeEvent(eventId: string, error: unknown) {
  const supabaseAdmin = await getSupabaseAdmin();
  const message = error instanceof Error ? error.message : "Unknown webhook error";
  const { error: updateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      last_error: message.slice(0, 1000),
    })
    .eq("event_id", eventId);

  if (updateError) {
    console.error("Stripe event failure logging failed:", updateError);
  }
}
