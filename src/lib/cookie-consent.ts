export const CONSENT_KEY = "imperio_cookie_consent";
export const CONSENT_MAX_AGE = 365 * 24 * 60 * 60;

export interface CookieConsent {
  version: string;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export function parseConsent(raw: string | null, version: string, now = Date.now()): CookieConsent | null {
  try {
    const value = JSON.parse(raw || "null");
    const timestamp = Date.parse(value?.updatedAt);
    if (value?.version !== version ||
      typeof value.preferences !== "boolean" ||
      typeof value.analytics !== "boolean" ||
      typeof value.marketing !== "boolean" ||
      !Number.isFinite(timestamp) || timestamp > now ||
      now - timestamp >= CONSENT_MAX_AGE * 1000) return null;
    return value;
  } catch {
    return null;
  }
}

export function readSavedConsent(version: string): CookieConsent | null {
  let local: CookieConsent | null = null;
  let cookie: CookieConsent | null = null;
  try { local = parseConsent(window.localStorage.getItem(CONSENT_KEY), version); } catch { /* Storage may be blocked. */ }
  try {
    const raw = document.cookie.split(";").map(part => part.trim())
      .find(part => part.startsWith(`${CONSENT_KEY}=`))?.slice(CONSENT_KEY.length + 1);
    cookie = parseConsent(raw ? decodeURIComponent(raw) : null, version);
  } catch { /* Cookies may also be blocked. */ }
  // Prefer the latest decision so an older backup cannot restore withdrawn consent.
  return [local, cookie].filter((value): value is CookieConsent => value !== null)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
}

export function saveConsent(consent: CookieConsent): void {
  const raw = JSON.stringify(consent);
  try { window.localStorage.setItem(CONSENT_KEY, raw); } catch { /* The cookie is a fallback. */ }
  try {
    const remaining = Math.max(0, Math.floor((Date.parse(consent.updatedAt) + CONSENT_MAX_AGE * 1000 - Date.now()) / 1000));
    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(raw)}; Max-Age=${remaining}; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  } catch { /* Keep the current page usable if all persistence is blocked. */ }
}
