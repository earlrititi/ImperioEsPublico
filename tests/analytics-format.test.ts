import test from "node:test";
import assert from "node:assert/strict";
import { formatAnalyticsMetric } from "../src/components/admin/Analytics";

test("analytics distinguishes unavailable values, genuine zeroes, money and purchaser rates", () => {
  assert.equal(formatAnalyticsMetric(undefined), "No disponible");
  assert.equal(formatAnalyticsMetric(NaN), "No disponible");
  assert.equal(formatAnalyticsMetric(0), "0");
  assert.match(formatAnalyticsMetric(0.125, "percent"), /12,5/);
  assert.match(formatAnalyticsMetric(26.99, "currency"), /26,99/);
  assert.doesNotMatch(formatAnalyticsMetric(0, "percent"), /No disponible/);
});
