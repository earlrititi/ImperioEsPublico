import test from "node:test";
import assert from "node:assert/strict";
import { ga4Requests, decodeGa4Reports, ga4Summary, automationRevenue } from "../src/lib/ga4-reports";

test("GA4 reports have fixed dimensions, bounded rows and complete days", () => {
  const requests = ga4Requests(30);
  assert.equal(requests.length, 5);
  assert.equal(requests[0].dateRanges[0].endDate, "yesterday");
  for (const request of requests.slice(0, 3)) {
    assert.ok(request.metrics.some(metric => metric.name === "purchaseRevenue"));
    assert.ok(request.metrics.some(metric => metric.name === "purchaserRate"));
  }
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

test("GA4 accepts net negative revenue after refunds but never negative counts or rates", () => {
  const reports = Array.from({length:5}, () => ({rows:[],rowCount:0})) as any[];
  reports[0].rows = [{metricValues:[0,0,0,0,-26.99,0].map(value=>({value:String(value)}))}];
  reports[1].rows = [{dimensionValues:[{value:"instagram / social"},{value:"launch"}],metricValues:[1,1,0,-26.99,0].map(value=>({value:String(value)}))}];
  assert.equal(decodeGa4Reports({reports}).traffic[0].metrics[3], -26.99);
  reports[0].rows[0].metricValues[0].value = "-1";
  assert.throws(() => decodeGa4Reports({reports}));
  reports[0].rows[0].metricValues[0].value = "0";
  reports[1].rows[0].metricValues[4].value = "-0.1";
  assert.throws(() => decodeGa4Reports({reports}));
});

test("automation revenue is measured campaign data, never an email-to-order inference", () => {
  const empty = decodeGa4Reports({reports:Array.from({length:5},()=>({rows:[]}))});
  assert.deepEqual(automationRevenue(empty).items, []);
  const summary = { ...empty, truncated: true, traffic: [
    {dimensions:["imperio_newsletter / email","imperio_welcome"],metrics:[4,3,1,22.31,0.3]},
    {dimensions:["instagram / social","imperio_welcome"],metrics:[8,5,2,50,0.4]},
    {dimensions:["imperio_newsletter / email","imperio_other"],metrics:[9,4,3,80,0.7]},
  ] };
  const measured = automationRevenue(summary);
  assert.deepEqual(measured.items, [{key:"welcome",sessions:4,purchases:1,revenue:22.31}]);
  assert.equal(measured.measuredOnly, true);
  assert.equal(measured.limited, true);
  assert.deepEqual(automationRevenue({...summary,status:"unavailable"}).items, []);
});
