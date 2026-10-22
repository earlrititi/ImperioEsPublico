import { GoogleAuth } from "google-auth-library";

export const GA4_PROPERTY_ID = "558692820";
export type Ga4ReportRow = { dimensions: string[]; metrics: number[] };
export type Ga4Summary = { status: "available" | "not_configured" | "unavailable"; measuredOnly: true;
  totals: Ga4ReportRow[]; traffic: Ga4ReportRow[]; devices: Ga4ReportRow[]; pages: Ga4ReportRow[]; events: Ga4ReportRow[];
  truncated: boolean; thresholded: boolean; };
export type AutomationRevenue = { status: Ga4Summary["status"]; days: 30; measuredOnly: true; limited: boolean;
  items: { key: string; sessions: number; purchases: number; revenue: number }[] };

export function automationRevenue(summary: Ga4Summary): AutomationRevenue {
  const items = new Map<string, AutomationRevenue["items"][number]>();
  if (summary.status === "available") for (const row of summary.traffic) {
    const key = /^imperio_(welcome|checkout|viewed_product|site|cart)$/.exec(row.dimensions[1] ?? "")?.[1];
    if (!key || row.dimensions[0] !== "imperio_newsletter / email" || row.metrics.length < 4) continue;
    const current = items.get(key) ?? { key, sessions: 0, purchases: 0, revenue: 0 };
    current.sessions += row.metrics[0]; current.purchases += row.metrics[2]; current.revenue += row.metrics[3];
    items.set(key, current);
  }
  return { status: summary.status, days: 30, measuredOnly: true, limited: summary.truncated || summary.thresholded, items: [...items.values()] };
}
export function ga4Requests(days: number) {
  if (![7, 30, 90, 365].includes(days)) throw Error("INVALID_INPUT");
  const report = (dimensions: string[], metrics: string[], limit = 100) => ({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "yesterday" }],
    currencyCode: "EUR",
    dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })),
    limit, orderBys: [{ metric: { metricName: metrics[0] }, desc: true }],
  });
  return [report([], ["activeUsers", "sessions", "screenPageViews", "ecommercePurchases", "purchaseRevenue", "purchaserRate"], 1),
    report(["sessionSourceMedium", "sessionCampaignName"], ["sessions", "activeUsers", "ecommercePurchases", "purchaseRevenue", "purchaserRate"]),
    report(["deviceCategory"], ["sessions", "activeUsers", "ecommercePurchases", "purchaseRevenue", "purchaserRate"]),
    report(["pagePath", "pageTitle"], ["screenPageViews", "activeUsers"]),
    report(["eventName"], ["eventCount", "totalUsers"])];
}
const empty = (status: Ga4Summary["status"]): Ga4Summary => ({ status, measuredOnly: true, totals: [], traffic: [], devices: [], pages: [], events: [], truncated: false, thresholded: false });
export function decodeGa4Reports(value: unknown): Ga4Summary {
  const reports = (value as { reports?: any[] })?.reports;
  if (!Array.isArray(reports) || reports.length !== 5) throw Error("INVALID_GA4_RESPONSE");
  const rows = reports.map((report, reportIndex) => {
    if (!Array.isArray(report.rows ?? [])) throw Error("INVALID_GA4_RESPONSE");
    return (report.rows ?? []).map((row: any) => ({
      dimensions: (row.dimensionValues ?? []).map((v: { value: string }) => String(v.value).slice(0, 500)),
      metrics: (row.metricValues ?? []).map((v: { value: string }, metricIndex: number) => {
        const revenueIndex = reportIndex === 0 ? 4 : reportIndex === 1 || reportIndex === 2 ? 3 : -1;
        const number = Number(v.value);
        if (!Number.isFinite(number) || (number < 0 && metricIndex !== revenueIndex)) throw Error("INVALID_GA4_RESPONSE");
        return number;
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
