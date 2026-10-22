import { createHmac, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { CONSENT_KEY, parseConsent } from "./cookie-consent";
import { getRequiredEnv } from "./env";
import { canTrackGooglePage } from "./google-analytics";

export const AUTH_ANALYTICS_COOKIE = "imperio_auth_analytics";
const lifetime = 5 * 60;
type Context = { cookies: AstroCookies; request: Request };
type AuthAction = { event: "login" | "sign_up"; method: "password" | "magic_link"; consentAt: string; id: string; expiresAt: number };
const domain = (request: Request) => ["imperioes.com", "www.imperioes.com"].includes(new URL(request.url).hostname) ? "imperioes.com" : undefined;
const signature = (value: string) => createHmac("sha256", getRequiredEnv("RATE_LIMIT_SECRET")).update(`auth-analytics:${value}`).digest();

export function clearAuthAnalytics({ cookies, request }: Context) {
  cookies.delete(AUTH_ANALYTICS_COOKIE, { path: "/", domain: domain(request) });
}

export function recordAuthAnalytics(context: Context, event: AuthAction["event"], method: AuthAction["method"]) {
  try {
    const consent = parseConsent(context.cookies.get(CONSENT_KEY)?.value ?? null, LEGAL_DOCUMENT_VERSIONS.cookies);
    if (!consent?.analytics) return;
    // No identity, email, token or destination is copied from the auth provider.
    const payload = Buffer.from(JSON.stringify({ event, method, consentAt: consent.updatedAt, at: Date.now() })).toString("base64url");
    context.cookies.set(AUTH_ANALYTICS_COOKIE, `${payload}.${signature(payload).toString("base64url")}`, {
      path: "/", domain: domain(context.request), httpOnly: true, secure: new URL(context.request.url).protocol === "https:",
      sameSite: "lax", maxAge: lifetime,
    });
  } catch { /* Optional analytics must never interrupt a successful authentication. */ }
}

export function consumeAuthAnalytics(context: Context, now = Date.now()): AuthAction | null {
  if (!canTrackGooglePage(context.request.url)) return null;
  const raw = context.cookies.get(AUTH_ANALYTICS_COOKIE)?.value;
  if (!raw) return null;
  clearAuthAnalytics(context);
  try {
    if (raw.length > 600) return null;
    const parts = raw.split(".");
    if (parts.length !== 2) return null;
    const mac = Buffer.from(parts[1], "base64url"), expected = signature(parts[0]);
    if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
    const value = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const consent = parseConsent(context.cookies.get(CONSENT_KEY)?.value ?? null, LEGAL_DOCUMENT_VERSIONS.cookies, now);
    if (!consent?.analytics || consent.updatedAt !== value.consentAt || !Number.isSafeInteger(value.at) || value.at > now || now - value.at >= lifetime * 1000 ||
      !["login", "sign_up"].includes(value.event) || !["password", "magic_link"].includes(value.method)) return null;
    return { event: value.event, method: value.method, consentAt: value.consentAt, id: mac.toString("hex"), expiresAt: value.at + lifetime * 1000 };
  } catch { return null; }
}
