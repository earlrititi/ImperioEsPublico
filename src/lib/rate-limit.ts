import { getRequiredEnv } from "./env";

function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function createBucketKey(request: Request, endpoint: string) {
  const secret = getRequiredEnv("RATE_LIMIT_SECRET");
  const payload = new TextEncoder().encode(`${endpoint}:${getClientAddress(request)}`);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, payload);

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function consumeRateLimit(params: {
  request: Request;
  endpoint: string;
  limit: number;
  windowSeconds: number;
}) {
  const { supabaseAdmin } = await import("./supabase/admin");
  const bucketKey = await createBucketKey(params.request, params.endpoint);
  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
    p_endpoint: params.endpoint,
    p_bucket_key: bucketKey,
    p_window_seconds: params.windowSeconds,
    p_limit: params.limit,
  });

  if (error) {
    console.error("Rate limit check failed:", error);
    throw error;
  }

  return data === true;
}
