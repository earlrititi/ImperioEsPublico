import assert from "node:assert/strict";
import fs from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import Stripe from "stripe";

const { values } = parseArgs({ options: { apply: { type: "boolean", default: false } } });
const filename = ".env.local";

async function main() {
  const env = parseEnv(fs.readFileSync(filename, "utf8"));
  assert(/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? ""), "TEST_KEY_REQUIRED");
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
  const account = await stripe.accounts.retrieve();
  assert.equal(account.id, "acct_1UCc4cDRITvLIOKF", "NEW_ACCOUNT_REQUIRED");
  let rate;
  for await (const candidate of stripe.taxRates.list({ active: true, inclusive: true, limit: 100 })) {
    if (!candidate.livemode && candidate.percentage === 21 && candidate.country === "ES") {
      rate = candidate;
      break;
    }
  }
  console.log(`Test account verified. Inclusive 21% VAT rate: ${rate ? "exists" : "needs creation"}.`);
  if (!values.apply) return;
  rate ??= await stripe.taxRates.create({ display_name: "IVA", description: "IVA Espana 21%",
    percentage: 21, inclusive: true, country: "ES" }, { idempotencyKey: "imperio-es-vat-inclusive-21-v1" });
  assert(!rate.livemode && rate.active && rate.inclusive && rate.percentage === 21, "INVALID_TEST_RATE");
  env.STRIPE_ES_VAT_RATE_ID = rate.id;
  // Mechanical env synchronization; values never enter command arguments or logs.
  fs.writeFileSync(filename, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n");
  console.log("Test VAT rate configured locally. No production, database or customer changes.");
}

main().catch(error => {
  console.error("Test tax setup stopped:", error.code || error.type || "VALIDATION_ERROR");
  process.exitCode = 1;
});
