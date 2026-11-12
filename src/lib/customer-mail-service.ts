import { createHash } from "node:crypto";
import { prepareCorporateEmail } from "./corporate-email";
import {
  sendCorporateMail as transportSend,
  type CorporateMailClient,
  type CorporateMailMessage,
  type CorporateMailOptions,
  type CorporateMailResponse,
  type CorporateMailContext as TransportContext,
} from "./corporate-mail-transport";

export { createCorporateMailClient } from "./corporate-mail-transport";
export type {
  CorporateMailClient,
  CorporateMailMessage,
  CorporateMailOptions,
  CorporateMailResponse,
} from "./corporate-mail-transport";
export type CorporateMailContext = TransportContext & {
  audit?: boolean;
  flow?: string;
  stage?: string;
};

export type CustomerMailAuditRow = {
  key: string;
  request_digest: string;
  payload_digest: string;
  recipient: string;
  subject: string;
  sender: string;
  flow: string;
  stage: string;
  status: "sent" | "failed";
  attempts: number;
  provider_id: string | null;
  delivery_status: "accepted_by_provider" | null;
  sent_at?: string;
  error: string | null;
};
type AcceptedAuditPatch = {
  status: "sent";
  provider_id: string;
  delivery_status: "accepted_by_provider";
  sent_at: string;
  error: null;
};
type AuditResult = { error: unknown };
export type CustomerMailAuditDatabase = {
  from(table: "customer_mail_deliveries"): {
    upsert(
      row: CustomerMailAuditRow,
      options: { onConflict: "key"; ignoreDuplicates: true },
    ): PromiseLike<AuditResult>;
    update(patch: AcceptedAuditPatch): {
      eq(
        column: "key",
        key: string,
      ): { in(column: "status", statuses: string[]): PromiseLike<AuditResult> };
    };
  };
};
type ServiceDependencies = {
  database: () => Promise<CustomerMailAuditDatabase>;
  auditEnabled: () => boolean;
  auditFailed: () => void;
};
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const metadataText = (value: string, max: number) =>
  value
    .replace(/https?:\/\/[^\s<>]+/gi, "[enlace omitido]")
    .replace(
      /\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      "[dato omitido]",
    )
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
const label = (value: string | undefined, fallback: string) =>
  value && /^[A-Za-z0-9_:-]{1,80}$/.test(value) ? value : fallback;

/** Dependency injection is limited to the metadata store; provider delivery is unchanged. */
export function createCustomerMailService(
  dependencies: Partial<ServiceDependencies> = {},
) {
  const deps: ServiceDependencies = {
    database: async () => (await import("./reservations")).database(),
    auditEnabled: () =>
      (import.meta.env?.CORPORATE_MAIL_AUDIT_ENABLED ??
        process.env.CORPORATE_MAIL_AUDIT_ENABLED) !== "false",
    auditFailed: () => {
      console.error("CORPORATE_MAIL_AUDIT_FAILED");
    },
    ...dependencies,
  };
  const record = async (
    original: CorporateMailMessage,
    payload: CorporateMailMessage,
    options: CorporateMailOptions | undefined,
    context: CorporateMailContext,
    response: CorporateMailResponse | null,
  ) => {
    try {
      const providerId = response?.data?.id ?? null;
      const identity = options?.idempotencyKey || providerId;
      if (!identity) return; // Unkeyed failures have no safe durable identity to invent.
      const recipients = [
        ...new Set(
          [payload.to, payload.cc ?? [], payload.bcc ?? []]
            .flat()
            .map((value) => value.trim().toLowerCase()),
        ),
      ].filter(
        (value) =>
          /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && value.length <= 254,
      );
      const db = await deps.database();
      const sentAt = new Date().toISOString();
      for (const recipient of recipients) {
        const row: CustomerMailAuditRow = {
          key: `audit:${digest([identity, recipient])}`,
          request_digest: digest(original),
          payload_digest: digest(payload),
          recipient,
          subject: metadataText(payload.subject ?? "", 250),
          sender: metadataText(payload.from ?? "", 320),
          flow: label(context.flow, "application"),
          stage: label(context.stage, "send"),
          status: providerId ? "sent" : "failed",
          attempts: 1,
          provider_id: providerId,
          delivery_status: providerId ? "accepted_by_provider" : null,
          ...(providerId ? { sent_at: sentAt } : {}),
          error: providerId
            ? null
            : response?.error
              ? "PROVIDER_REJECTED"
              : "PROVIDER_REQUEST_FAILED",
        };
        const inserted = await db
          .from("customer_mail_deliveries")
          .upsert(row, { onConflict: "key", ignoreDuplicates: true });
        if (inserted.error) throw Error("AUDIT_STORE_FAILED");
        // A retry may establish acceptance after a recorded failure. Never
        // downgrade an already sent/delivered record or a strict ledger claim.
        if (providerId) {
          const updated = await db
            .from("customer_mail_deliveries")
            .update({
              status: "sent",
              provider_id: providerId,
              delivery_status: "accepted_by_provider",
              sent_at: sentAt,
              error: null,
            })
            .eq("key", row.key)
            .in("status", ["pending", "failed"]);
          if (updated.error) throw Error("AUDIT_STORE_FAILED");
        }
      }
    } catch {
      deps.auditFailed();
    }
  };
  const sendCorporateMail = async (
    client: CorporateMailClient,
    message: CorporateMailMessage,
    options?: CorporateMailOptions,
    context: CorporateMailContext = {},
  ): Promise<CorporateMailResponse> => {
    if (context.audit === false || !deps.auditEnabled())
      return transportSend(client, message, options, context);
    // Freeze the same prepared payload for transport and its digest. Bodies
    // and signed links are never copied into the metadata store.
    const payload = prepareCorporateEmail(
      message,
      context.preserveSnapshot === true,
    );
    let response: CorporateMailResponse;
    try {
      response = await transportSend(client, payload, options, {
        preserveSnapshot: true,
      });
    } catch (error) {
      await record(message, payload, options, context, null);
      throw error;
    }
    await record(message, payload, options, context, response);
    return response;
  };
  return { sendCorporateMail };
}

export const { sendCorporateMail } = createCustomerMailService();
