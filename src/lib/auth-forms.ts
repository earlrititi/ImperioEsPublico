import { consumeRateLimit } from "./rate-limit";

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function validNewPassword(value: string) {
  return value.length >= 12 && new TextEncoder().encode(value).length <= 72;
}
export async function readAuthForm(request: Request, endpoint: string) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("origin");
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) throw new Error("validation");
  const body = await request.text();
  if (body.length > 16384) throw new Error("validation");
  const allowed = await consumeRateLimit({ request, endpoint, limit: 5, windowSeconds: 15 * 60 });
  if (!allowed) throw new Error("rate");
  return new URLSearchParams(body);
}
export function authError(error: unknown) {
  return error instanceof Error && ["origin", "validation", "rate"].includes(error.message) ? error.message : "unavailable";
}
export function privateAuthHeaders(headers: Headers) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Vercel-CDN-Cache-Control", "no-store");
  // Native POST forms need their Origin; no-referrer makes browsers send null.
  headers.set("Referrer-Policy", "same-origin");
}
