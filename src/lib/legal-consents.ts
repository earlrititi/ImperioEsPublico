export type LegalConsentType =
  | "terms"
  | "privacy_acknowledgement"
  | "marketing_email"
  | "cookies_preferences"
  | "cookies_analytics"
  | "cookies_marketing"
  | "digital_content_immediate_access"
  | "digital_withdrawal_acknowledgement";

export type LegalConsentInput = {
  userId?: string | null;
  anonymousId?: string | null;
  consentType: LegalConsentType;
  documentVersion: string;
  accepted: boolean;
  source: string;
  contextType?: string | null;
  contextId?: string | null;
  metadata?: Record<string, string | boolean | number | null>;
};

export async function recordLegalConsents(consents: LegalConsentInput[]) {
  if (consents.length === 0) {
    return;
  }

  const { supabaseAdmin } = await import("./supabase/admin");
  const createdAt = new Date().toISOString();
  const rows = consents.map((consent) => ({
    user_id: consent.userId ?? null,
    anonymous_id: consent.anonymousId ?? null,
    consent_type: consent.consentType,
    document_version: consent.documentVersion,
    accepted: consent.accepted,
    source: consent.source,
    context_type: consent.contextType ?? null,
    context_id: consent.contextId ?? null,
    metadata: consent.metadata ?? {},
    created_at: createdAt,
    withdrawn_at: consent.accepted ? null : createdAt,
  }));
  const { error } = await supabaseAdmin.from("legal_consents").insert(rows);

  if (error) {
    console.error("recordLegalConsents error:", error);
    throw error;
  }
}

export async function linkAnonymousConsents(params: {
  anonymousId: string;
  userId: string;
}) {
  const { supabaseAdmin } = await import("./supabase/admin");
  const { error } = await supabaseAdmin
    .from("legal_consents")
    .update({ user_id: params.userId })
    .eq("anonymous_id", params.anonymousId)
    .is("user_id", null);

  if (error) {
    console.error("linkAnonymousConsents error:", error);
    throw error;
  }
}
