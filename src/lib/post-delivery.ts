import { createHmac, timingSafeEqual } from "node:crypto";
import { DELIVERY_LABELS } from "./post-delivery-labels";
export { DELIVERY_LABELS } from "./post-delivery-labels";

export type DeliveryKind = "carrier_delivered" | "customer_received" | "issue_opened" | "issue_resolved" | "returned";
export type PostDeliveryKind = "delivery_check" | "post_delivery_loyalty";
export type DeliveryOrder = {
  status: string; paid_at: string; carrier_delivered_at: string | null; customer_received_at: string | null;
  delivery_issue_at: string | null; delivery_returned_at: string | null; delivery_disputed_at?: string | null; refunded_amount?: number;
};
export function deliveryEventInput(input: Record<string, unknown>, customer = false) {
  const kind = input.kind;
  const allowed = customer ? ["customer_received", "issue_opened"] : Object.keys(DELIVERY_LABELS);
  if (typeof kind !== "string" || !allowed.includes(kind)) throw Error("INVALID_INPUT");
  const packageCount = input.packageCount ?? 1, packageIndex = input.packageIndex ?? 1;
  if (!Number.isInteger(packageCount) || !Number.isInteger(packageIndex) || Number(packageCount) < 1 || Number(packageCount) > 50 ||
    Number(packageIndex) < 1 || Number(packageIndex) > Number(packageCount)) throw Error("INVALID_INPUT");
  const evidence = typeof input.evidence === "string" ? input.evidence.trim() : "";
  // References to a private delivery document/ticket, never its personal contents.
  if (!customer && ["carrier_delivered", "returned", "issue_resolved"].includes(kind) && evidence.length < 5) throw Error("DELIVERY_EVIDENCE_REQUIRED");
  if (evidence.length > 250 || /[\r\n<>]/.test(evidence)) throw Error("INVALID_INPUT");
  const occurredAt = input.occurredAt;
  if (typeof occurredAt !== "string" || !Number.isFinite(Date.parse(occurredAt)) || Date.parse(occurredAt) > Date.now() + 60000)
    throw Error("INVALID_INPUT");
  return { kind: kind as DeliveryKind, packageCount: Number(packageCount), packageIndex: Number(packageIndex), evidence, occurredAt: new Date(occurredAt).toISOString() };
}

export function deliveryMessageEligible(order: DeliveryOrder, kind: PostDeliveryKind, marketingEligible: boolean) {
  if (["CANCELLED", "REFUNDED"].includes(order.status) || order.delivery_issue_at || order.delivery_returned_at || order.delivery_disputed_at || Number(order.refunded_amount ?? 0) > 0) return false;
  return kind === "delivery_check" ? Boolean(order.carrier_delivered_at && !order.customer_received_at)
    : Boolean(order.customer_received_at && marketingEligible);
}

// Domain-separated capability; no email/order personal data appear in the URL.
export function receiptCapability(jobId: string, expires: number, secret: string) {
  if (secret.length < 32 || !/^[0-9a-f-]{36}$/i.test(jobId) || !Number.isSafeInteger(expires)) throw Error("INVALID_INPUT");
  const value = `${jobId}.${expires}`;
  return `${value}.${createHmac("sha256", secret).update(`delivery-receipt:v1:${value}`).digest("hex")}`;
}
export function verifyReceiptCapability(token: string, secret: string, now = Date.now()) {
  const [jobId, stamp, signature, extra] = token.split(".");
  const expires = Number(stamp);
  if (extra || !/^[0-9a-f-]{36}$/i.test(jobId ?? "") || !/^\d{13}$/.test(stamp ?? "") || !/^[a-f0-9]{64}$/.test(signature ?? "") ||
    !Number.isSafeInteger(expires) || expires <= now || expires > now + 15 * 86400000 || secret.length < 32) throw Error("NOT_FOUND");
  const expected = receiptCapability(jobId, expires, secret).split(".")[2];
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw Error("NOT_FOUND");
  return { jobId, expires: new Date(expires).toISOString() };
}

export function postDeliveryDelay(value: string, fallback: number) {
  const hours = value ? Number(value) : fallback;
  if (!Number.isInteger(hours) || hours < 24 || hours > 336) throw Error("INVALID_POST_DELIVERY_DELAY");
  return hours;
}
