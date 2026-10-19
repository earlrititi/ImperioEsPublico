import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { GoogleAuth } from "google-auth-library";
import { decodeGa4Reports, GA4_PROPERTY_ID, ga4Requests } from "../src/lib/ga4-reports.ts";

const { values } = parseArgs({ options: { "credential-file": { type: "string" } } });
const raw = values["credential-file"] ? readFileSync(values["credential-file"], "utf8") : process.env.GA4_SERVICE_ACCOUNT_JSON;
assert.ok(raw, "SERVER_CREDENTIAL_REQUIRED");
const credentials = JSON.parse(raw);
assert.equal(credentials.type, "service_account");
assert.equal(credentials.client_email, "imperio-ga4-reader@imperio-e-analytics.iam.gserviceaccount.com");
assert.equal(credentials.project_id, "imperio-e-analytics");
const auth = new GoogleAuth({ credentials: { type: credentials.type, client_email: credentials.client_email,
  private_key: credentials.private_key }, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
try {
  const client = await auth.getClient();
  const response = await client.request({ url: `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:batchRunReports`,
    method: "POST", data: { requests: ga4Requests(30) }, timeout: 15000 });
  const result = decodeGa4Reports(response.data);
  // Only aggregates are printed, never OAuth responses, credentials or page URLs.
  console.log(JSON.stringify({ status: result.status, property: GA4_PROPERTY_ID, days: 30, ends: "yesterday",
    totals: result.totals, reportRows: { traffic: result.traffic.length, devices: result.devices.length,
      pages: result.pages.length, events: result.events.length }, thresholded: result.thresholded, truncated: result.truncated }, null, 2));
} catch (error) {
  const data = error?.response?.data?.error;
  const reason = data?.details?.find(detail => typeof detail?.reason === "string")?.reason;
  console.error(JSON.stringify({ status: "unavailable", httpStatus: error?.response?.status ?? null,
    code: typeof data?.status === "string" ? data.status : "REQUEST_FAILED",
    reason: /^[A-Z_]+$/.test(reason ?? "") ? reason : null }));
  process.exitCode = 1;
}
