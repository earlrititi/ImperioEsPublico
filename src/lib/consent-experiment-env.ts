export function consentExperimentEnabled(hostname: string, prerender = false) {
  const environment = process.env.VERCEL_ENV ?? import.meta.env.VERCEL_ENV;
  const enabled = (process.env.CONSENT_EXPERIMENT_PREVIEW ?? import.meta.env.CONSENT_EXPERIMENT_PREVIEW) === "true";
  if (!enabled || environment === "production") return false;
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  return local || (environment === "preview" && (prerender || hostname.endsWith(".vercel.app")));
}
