import { GoogleAuth } from "google-auth-library";

export const GA4_PROPERTY_ID = "558692820";
export type Ga4ReportRow = { dimensions: string[]; metrics: number[] };
export type Ga4Summary = { status: "available" | "not_configured" | "unavailable"; measuredOnly: true;
  totals: Ga4ReportRow[]; traffic: Ga4ReportRow[]; devices: Ga4ReportRow[]; pages: Ga4ReportRow[]; events: Ga4ReportRow[];
  truncated: boolean; thresholded: boolean; };
export function ga4Requests(days: number) {
  if (![7, 30, 90, 365].includes(days)) throw Error("INVALID_INPUT");
  const report = (dimensions: string[], metrics: string[], limit = 100) => ({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "yesterday" }],
    currencyCode: "EUR",
    dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })),
    limit, orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
  });
  return [report([], ["activeUsers", "sessions", "screenPageViews", "ecommercePurchases", "purchaseRevenue"], 1),
    report(["sessionSourceMedium", "sessionCampaignName"], ["sessions", "activeUsers", "ecommercePurchases"]),
    report(["deviceCategory"], ["sessions", "activeUsers", "ecommercePurchases"]),
    report(["pagePath", "pageTitle"], ["screenPageViews", "activeUsers"]),
    report(["eventName"], ["eventCount", "totalUsers"])];
}
const empty = (status: Ga4Summary["status"]): Ga4Summary => ({ status, measuredOnly: true, totals: [], traffic: [], devices: [], pages: [], events: [], truncated: false, thresholded: false });
export function decodeGa4Reports(value: unknown): Ga4Summary {
  const reports = (value as { reports?: any[] })?.reports;
  if (!Array.isArray(reports) || reports.length !== 5) throw Error("INVALID_GA4_RESPONSE");
  const rows = reports.map(report => {
    if (!Array.isArray(report.rows ?? [])) throw Error("INVALID_GA4_RESPONSE");
    return (report.rows ?? []).map((row: any) => ({
      dimensions: (row.dimensionValues ?? []).map((v: { value: string }) => String(v.value).slice(0, 500)),
      metrics: (row.metricValues ?? []).map((v: { value: string }) => {
        const number = Number(v.value); if (!Number.isFinite(number) || number < 0) throw Error("INVALID_GA4_RESPONSE"); return number;
      }),
    }));
  });
  return { status: "available", measuredOnly: true, totals: rows[0], traffic: rows[1], devices: rows[2], pages: rows[3], events: rows[4],
    truncated: reports.some(r => Number(r.rowCount ?? 0) > (r.rows?.length ?? 0)),
    thresholded: reports.some(r => r.metadata?.subjectToThresholding === true) };
}
export async function ga4Summary(days: number): Promise<Ga4Summary> {
  // Runtime-only: never substitute service-account material into the Vite bundle.
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return empty("not_configured");
  try {
    const credentials = JSON.parse(raw);
    if (credentials.type !== "service_account" || typeof credentials.client_email !== "string" || !credentials.client_email.endsWith(".iam.gserviceaccount.com") || typeof credentials.private_key !== "string") return empty("unavailable");
    const auth = new GoogleAuth({ credentials: { type: "service_account", client_email: credentials.client_email, private_key: credentials.private_key }, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
    const client = await auth.getClient();
    const result = await client.request({
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:batchRunReports`, method: "POST",
      data: { requests: ga4Requests(days) }, timeout: 12000,
    });
    return decodeGa4Reports(result.data);
  } catch { return empty("unavailable"); }
}
