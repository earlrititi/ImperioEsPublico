import { createHmac, timingSafeEqual } from "node:crypto";
import { authMailPlans } from "./auth-mail-catalog";

export type AuthMailClaim = {
  p_key: string;
  p_request_digest: string;
  p_payload_digest: string;
  p_recipient: string;
  p_subject: string;
  p_flow: string;
  p_stage: string;
  p_sender: string;
};
export type AuthMailClaimed = {
  id: string;
  status: string;
  claim_id: string | null;
  provider_id: string | null;
};
type AuthMailMessage = {
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};
export type AuthMailDependencies = {
  secret: string;
  idempotencySecret: string;
  siteUrl: string;
  from: string;
  replyTo: string;
  claim(input: AuthMailClaim): Promise<AuthMailClaimed | null>;
  send(
    message: AuthMailMessage,
    options: { idempotencyKey: string },
  ): Promise<{ data: { id: string } | null; error: unknown }>;
  complete(id: string, claim: string, providerId: string): Promise<void>;
  fail(id: string, claim: string, code: string): Promise<void>;
  transformMessage?: (message: AuthMailMessage) => AuthMailMessage;
  now?: number;
};

const MAX_BYTES = 128 * 1024;
const response = (status: number, code?: string) =>
  Response.json(code ? { error: { http_code: status, message: code } } : {}, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
      ...(status === 503 ? { "Retry-After": "1" } : {}),
    },
  });

/** Standard Webhooks signatures cover the original bytes, before JSON parsing. */
export function verifyAuthMailSignature(
  body: string,
  headers: Headers,
  secrets: string,
  now = Date.now(),
) {
  const id = headers.get("webhook-id"),
    timestamp = headers.get("webhook-timestamp"),
    signature = headers.get("webhook-signature");
  if (
    !id ||
    id.length > 200 ||
    /[\r\n]/.test(id) ||
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    !signature ||
    signature.length > 4096
  )
    return false;
  if (Math.abs(now - Number(timestamp) * 1000) > 300_000) return false;
  const keys = secrets
    .split(/[;\s]+/)
    .filter((value) => /^(?:v1,)?whsec_[A-Za-z0-9+/]+={0,2}$/.test(value));
  for (const raw of keys) {
    const encoded = raw.replace(/^v1,/, "").slice(6);
    const key = Buffer.from(encoded, "base64");
    if (
      key.length < 32 ||
      key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")
    )
      continue;
    const expected = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest();
    for (const part of signature.split(/\s+/)) {
      const [version, value] = part.split(",");
      if (version !== "v1" || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
        continue;
      const received = Buffer.from(value, "base64");
      if (
        received.length === expected.length &&
        timingSafeEqual(received, expected)
      )
        return true;
    }
  }
  return false;
}

async function boundedBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > MAX_BYTES)
    throw Error("PAYLOAD_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw Error("INVALID_PAYLOAD");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) {
      await reader.cancel();
      throw Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}

/** Auth owns tokens and account state; this handler only delivers signed requests. */
export async function handleAuthMailRequest(
  request: Request,
  dependencies: AuthMailDependencies,
) {
  if (request.method !== "POST") return response(405, "METHOD_NOT_ALLOWED");
  if (!dependencies.secret || dependencies.idempotencySecret.length < 32)
    return response(503, "AUTH_MAIL_NOT_CONFIGURED");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return response(415, "JSON_REQUIRED");
  let body: string;
  try {
    body = await boundedBody(request);
  } catch (error) {
    return response(
      error instanceof Error && error.message === "PAYLOAD_TOO_LARGE"
        ? 413
        : 400,
      "INVALID_PAYLOAD",
    );
  }
  if (
    !verifyAuthMailSignature(
      body,
      request.headers,
      dependencies.secret,
      dependencies.now,
    )
  )
    return response(401, "INVALID_SIGNATURE");
  let plans: ReturnType<typeof authMailPlans>;
  try {
    plans = authMailPlans(JSON.parse(body), { siteUrl: dependencies.siteUrl });
  } catch {
    return response(400, "AUTH_MAIL_PAYLOAD_INVALID");
  }

  // Supabase can change webhook-id on retries. Its signed payload stays stable.
  const digest = createHmac("sha256", dependencies.idempotencySecret)
    .update(`auth-mail-request:v1\0${body}`)
    .digest("hex");
  const outcomes = await Promise.allSettled(
    plans.map(async (plan) => {
      const key = `auth-mail:v1:${digest}:${plan.slot}`;
      const original = {
        from: dependencies.from,
        replyTo: dependencies.replyTo,
        to: plan.to,
        subject: plan.subject,
        html: plan.html,
        text: plan.text,
      };
      const message = dependencies.transformMessage
        ? dependencies.transformMessage(original)
        : original;
      const payloadDigest = createHmac("sha256", dependencies.idempotencySecret)
        .update(`auth-mail-payload:v1\0${JSON.stringify(message)}`)
        .digest("hex");
      const row = await dependencies.claim({
        p_key: key,
        p_request_digest: digest,
        p_payload_digest: payloadDigest,
        p_recipient: message.to,
        p_subject: message.subject,
        p_flow: "supabase_auth",
        p_stage: plan.action,
        p_sender: message.from,
      });
      if (!row) throw Error("AUTH_MAIL_BUSY");
      if (row.status === "sent" && row.provider_id) return;
      if (row.status !== "processing" || !row.claim_id)
        throw Error("AUTH_MAIL_REVIEW_REQUIRED");
      let providerId: string;
      try {
        const sent = await dependencies.send(message, { idempotencyKey: key });
        if (sent.error || !sent.data?.id) throw Error("PROVIDER_NOT_ACCEPTED");
        providerId = sent.data.id;
      } catch {
        await dependencies
          .fail(row.id, row.claim_id, "AUTH_PROVIDER_NOT_ACCEPTED")
          .catch(() => undefined);
        throw Error("AUTH_PROVIDER_NOT_ACCEPTED");
      }
      // On an uncertain acknowledgement, a retry uses the same frozen digest/key.
      await dependencies.complete(row.id, row.claim_id, providerId);
    }),
  );
  if (outcomes.some((result) => result.status === "rejected"))
    return response(503, "AUTH_MAIL_RETRY_REQUIRED");
  return response(200);
}
