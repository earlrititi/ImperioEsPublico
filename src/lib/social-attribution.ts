import { readSavedConsent } from "./cookie-consent";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";

export function campaignParameters(search: string) {
  const input = new URLSearchParams(search);
  const result = new URLSearchParams();
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const value = input.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) result.set(key, value);
  }
  return result;
}

export function attributedPath(path: string, search = window.location.search) {
  const url = new URL(path, window.location.origin);
  campaignParameters(search).forEach((value, key) => url.searchParams.set(key, value));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function socialEvent(event: string, details: Record<string, string | number> = {}) {
  if (!readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) return;
  const target = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  const attribution = Object.fromEntries(campaignParameters(window.location.search));
  // Never send contact details or reservation management tokens to analytics.
  const payload = { ...attribution, ...details, page_location: `${window.location.origin}${window.location.pathname}` };
  if (target.gtag) target.gtag("event", event, payload);
  else (target.dataLayer ??= []).push({ event, ...payload });
}
