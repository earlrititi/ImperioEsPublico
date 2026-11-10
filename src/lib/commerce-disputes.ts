type DisputeSnapshot = { id: string; created: number; payment_intent: string | { id: string } | null };
/** Called only inside the existing authenticated, mode-checked Stripe handler.
 * Read the provider's current object instead of trusting a possibly stale event. */
export async function captureDeliveryDispute(id: string, retrieve: (id: string) => Promise<DisputeSnapshot>,
  persist: (args: { p_intent: string; p_dispute: string; p_at: string }) => Promise<unknown>) {
  const current = await retrieve(id);
  const intent = typeof current.payment_intent === "string" ? current.payment_intent : current.payment_intent?.id;
  if (!intent) return false;
  if (current.id !== id || !Number.isSafeInteger(current.created) || current.created <= 0) throw Error("DISPUTE_INVALID_PROVIDER_RESPONSE");
  await persist({ p_intent: intent, p_dispute: current.id, p_at: new Date(current.created * 1000).toISOString() });
  return true;
}
