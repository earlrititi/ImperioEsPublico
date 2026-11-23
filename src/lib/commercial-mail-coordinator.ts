import { createHash } from "node:crypto";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { rpc } from "./reservations";
import type { CorporateMailMessage } from "./customer-mail-service";
import { archiveAcceptedCustomerMail } from "./customer-mail-archive";

export type CommercialSource = "automation" | "admin" | "post_delivery";
export type CommercialReservation = {
  action: "send" | "deferred" | "suppressed" | "review" | "accepted";
  reason?: string;
  retryAt?: string;
  receiptId?: string;
  receiptClaimId?: string;
  providerId?: string;
};
type CoordinatorRpc = (name: string, args: Record<string, unknown>) => Promise<any>;

/** A reservation is durable before HTTP. An uncertain result holds the slot;
 * only the same source job and provider idempotency key may retry it. */
export function createCommercialMailCoordinator(
  call: CoordinatorRpc = rpc,
  archive: (key: string, payload: CorporateMailMessage) => Promise<void> = async (key, payload) => {
    const { database } = await import("./reservations");
    await archiveAcceptedCustomerMail(await database(), key, payload, { flow: "commercial" });
  },
) {
  const payloads = new WeakMap<CommercialReservation, { key: string; payload: CorporateMailMessage }>();
  return {
    async beginCommercialSend(input: {
      source: CommercialSource;
      jobId: string;
      claimId: string;
      payload: CorporateMailMessage;
    }): Promise<CommercialReservation> {
      const digest = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
      const result = await call("reserve_commercial_mail", {
        p_source: input.source, p_job: input.jobId, p_claim: input.claimId,
        p_digest: digest, p_analytics_version: LEGAL_DOCUMENT_VERSIONS.cookies,
      });
      if (!result || !["send", "deferred", "suppressed", "review", "accepted"].includes(result.action))
        throw Error("COMMERCIAL_RESERVATION_UNAVAILABLE");
      if (result.action === "send" && (!result.receipt_id || !result.receipt_claim_id))
        throw Error("COMMERCIAL_RESERVATION_UNAVAILABLE");
      if (result.action === "accepted" && !result.provider_id)
        throw Error("COMMERCIAL_RECEIPT_UNAVAILABLE");
      const reservation: CommercialReservation = {
        action: result.action, reason: result.reason, retryAt: result.retry_at,
        receiptId: result.receipt_id, receiptClaimId: result.receipt_claim_id,
        providerId: result.provider_id,
      };
      if (reservation.action === "send") payloads.set(reservation, {
        key: `commercial:${input.source}:${input.jobId}`, payload: input.payload,
      });
      return reservation;
    },
    async completeCommercialSend(reservation: CommercialReservation, providerId: string) {
      if (reservation.action !== "send" || !providerId) throw Error("COMMERCIAL_RECEIPT_REQUIRED");
      const completed = await call("complete_customer_mail", {
        p_id: reservation.receiptId, p_claim: reservation.receiptClaimId, p_provider: providerId,
      });
      if (completed !== true) throw Error("COMMERCIAL_RECEIPT_UNAVAILABLE");
      const copy = payloads.get(reservation);
      if (copy) {
        // Acceptance is authoritative even if the optional sanitized copy fails.
        try { await archive(copy.key, copy.payload); }
        catch { console.error("COMMERCIAL_MAIL_ARCHIVE_UNAVAILABLE"); }
        payloads.delete(reservation);
      }
    },
    async failCommercialSend(reservation: CommercialReservation) {
      if (reservation.action !== "send") return;
      const saved = await call("fail_customer_mail", {
        p_id: reservation.receiptId, p_claim: reservation.receiptClaimId,
        p_code: "COMMERCIAL_RESULT_UNCERTAIN",
      });
      if (saved !== true) throw Error("COMMERCIAL_RECEIPT_UNAVAILABLE");
    },
  };
}

export const { beginCommercialSend, completeCommercialSend, failCommercialSend } = createCommercialMailCoordinator();
