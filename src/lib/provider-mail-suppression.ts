type SuppressionDatabase = {
  from(table: "email_suppressions"): {
    upsert(
      row: { email: string; reason: "provider_suppressed" },
      options: { onConflict: "email"; ignoreDuplicates: true },
    ): PromiseLike<{ error: unknown }>;
  };
};

/** Resend already blocked this address. Mirror that fact without replacing a
 * previous local suppression or attempting to remove the provider's block. */
export async function recordProviderSuppressed(email: string, store?: SuppressionDatabase) {
  const recipient = email.trim().toLowerCase();
  if (recipient.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))
    throw Error("INVALID_SUPPRESSION_RECIPIENT");
  const db = store ?? await (await import("./reservations")).database();
  const result = await db.from("email_suppressions").upsert(
    { email: recipient, reason: "provider_suppressed" },
    { onConflict: "email", ignoreDuplicates: true },
  );
  if (result.error) throw Error("PROVIDER_SUPPRESSION_UNAVAILABLE");
}
