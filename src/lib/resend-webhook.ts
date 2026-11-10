import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const RESEND_EVENT_TYPES = [
  "sent",
  "delivered",
  "delivery_delayed",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "failed",
  "suppressed",
] as const;
export type ResendEventType = typeof RESEND_EVENT_TYPES[number];

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function verifySvixSignature(params: {
  headers: SvixHeaders;
  body: string;
  secret: string;
  now?: number;
}) {
  const { id, timestamp, signature } = params.headers;
  if (!id || !timestamp || !signature || !params.secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  const now = params.now ?? Date.now();
  if (Math.abs(now - seconds * 1000) > 5 * 60 * 1000) return false;
  const key = params.secret.startsWith("whsec_")
    ? Buffer.from(params.secret.slice("whsec_".length), "base64")
    : Buffer.from(params.secret, "utf8");
  if (!key.length) return false;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${params.body}`)
    .digest();
  for (const part of signature.split(" ")) {
    const [version, encoded] = part.split(",");
    if (version !== "v1" || !encoded) continue;
    const received = Buffer.from(encoded, "base64");
    if (received.length === expected.length && timingSafeEqual(received, expected)) return true;
  }
  return false;
}

const EVENT_MAP: Record<string, ResendEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

export function resendEventType(type: unknown): ResendEventType | null {
  return typeof type === "string" ? EVENT_MAP[type] ?? null : null;
}

export function resendMessageId(data: any): string {
  const value = data?.email_id ?? data?.id ?? data?.message_id;
  return typeof value === "string" && value.length > 0 && value.length <= 200 ? value : "";
}

export function resendRecipient(data: any): string {
  const raw = Array.isArray(data?.to) ? data.to[0] : data?.to ?? data?.recipient ?? data?.email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function resendOccurredAt(payload: any, fallback = new Date()) {
  const raw = payload?.created_at ?? payload?.createdAt;
  const time = typeof raw === "string" ? Date.parse(raw) : Date.parse(String(raw ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback.toISOString();
}

export function resendDedupeKey(params: {
  svixId: string | null;
  eventType: ResendEventType;
  messageId: string;
  occurredAt: string;
}) {
  const base = params.svixId
    ? `svix:${params.svixId}`
    : `${params.eventType}:${params.messageId}:${params.occurredAt}`;
  return base.length <= 300 ? base : `sha256:${createHash("sha256").update(base).digest("hex")}`;
}

export function resendDeliveryState(eventType: ResendEventType) {
  if (eventType === "delivered") return { status: "delivered", confirmed: true };
  if (eventType === "delivery_delayed") return { status: "delivery_delayed", confirmed: false };
  if (eventType === "bounced") return { status: "bounced", confirmed: false };
  if (eventType === "complained") return { status: "complained", confirmed: false };
  if (eventType === "failed") return { status: "failed", confirmed: false };
  if (eventType === "suppressed") return { status: "suppressed", confirmed: false };
  return null;
}

export function permanentBounce(data: any) {
  const type = String(data?.bounce?.type ?? data?.bounceType ?? data?.bounce?.subType ?? "").toLowerCase();
  return type === "permanent" || type === "hard" || type === "hard_bounce";
}

export function suppressionReason(eventType: ResendEventType, data: any): "provider_bounced" | "provider_complained" | null {
  if (eventType === "complained") return "provider_complained";
  if (eventType === "bounced" && permanentBounce(data)) return "provider_bounced";
  return null;
}

export function resendClickUrl(data: any) {
  const value = data?.click?.link ?? data?.click?.url ?? data?.url;
  return typeof value === "string" && value.length <= 2048 ? value : null;
}

export function safeEventDetail(eventType: ResendEventType, data: any) {
  const detail: Record<string, unknown> = {};
  if (eventType === "bounced") {
    const bounce = data?.bounce ?? {};
    if (typeof bounce.type === "string") detail.bounce_type = bounce.type.slice(0, 80);
    if (typeof bounce.subType === "string") detail.bounce_subtype = bounce.subType.slice(0, 80);
  }
  if (eventType === "clicked") {
    const url = resendClickUrl(data);
    if (url) detail.url = url;
  }
  if (eventType === "failed" && typeof data?.reason === "string") detail.reason = data.reason.slice(0, 200);
  return detail;
}
