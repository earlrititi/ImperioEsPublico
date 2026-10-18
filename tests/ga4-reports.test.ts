import test from "node:test";
import assert from "node:assert/strict";
import { ga4Requests, decodeGa4Reports, ga4Summary } from "../src/lib/ga4-reports";

test("GA4 reports have fixed dimensions, bounded rows and complete days", () => {
  const requests = ga4Requests(30);
  assert.equal(requests.length, 5);
  assert.equal(requests[0].dateRanges[0].endDate, "yesterday");
  assert.ok(requests.every(r => r.limit <= 100));
  assert.doesNotMatch(JSON.stringify(requests), /email|userId|clientId|address/);
  assert.throws(() => ga4Requests(999));
});
test("GA4 keeps missing, empty and limited data distinct", async () => {
  const old = process.env.GA4_SERVICE_ACCOUNT_JSON;
  delete process.env.GA4_SERVICE_ACCOUNT_JSON;
  try { assert.equal((await ga4Summary(30)).status, "not_configured"); }
  finally { if (old !== undefined) process.env.GA4_SERVICE_ACCOUNT_JSON = old; }
  const reports = Array.from({length:5}, () => ({rows:[],rowCount:0}));
  assert.equal(decodeGa4Reports({reports}).status, "available");
  assert.deepEqual(decodeGa4Reports({reports}).totals, []);
  assert.equal(decodeGa4Reports({reports:reports.map(r=>({...r,rowCount:10}))}).truncated, true);
  assert.throws(() => decodeGa4Reports({reports:[]}));
});
