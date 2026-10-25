import { getRequiredEnv } from "./env";

export function authCaptchaConfig() {
  let enabled = false;
  let siteKey = "";
  try { enabled = getRequiredEnv("AUTH_CAPTCHA_ENABLED") === "true"; } catch { /* Disabled until provisioned. */ }
  if (enabled) {
    try { siteKey = getRequiredEnv("PUBLIC_TURNSTILE_SITE_KEY").trim(); } catch { /* Fail closed below. */ }
  }
  return { enabled, siteKey };
}

export function authCaptchaToken(form: URLSearchParams) {
  const { enabled, siteKey } = authCaptchaConfig();
  if (!enabled) return undefined;
  const tokens = form.getAll("cf-turnstile-response");
  if (!siteKey || tokens.length !== 1 || !tokens[0].trim() || tokens[0].length > 2048) {
    throw new Error("captcha");
  }
  // Supabase validates this single-use token with Turnstile, not the browser.
  return tokens[0];
}

export const isAuthCaptchaFailure = (error: { code?: string } | null) => error?.code === "captcha_failed";
