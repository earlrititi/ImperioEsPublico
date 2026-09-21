import type Stripe from "stripe";
import { ES_VAT } from "../config/tax";
import { getRequiredEnv } from "./env";

export function isValidEsVatRate(
  rate: Pick<Stripe.TaxRate, "active" | "inclusive" | "percentage" | "country" | "livemode">,
  livemode: boolean
) {
  return rate.active && rate.inclusive === ES_VAT.inclusive &&
    rate.percentage === ES_VAT.percentage && rate.country === ES_VAT.country &&
    rate.livemode === livemode;
}

export async function getEsVatRate(stripe: Stripe, livemode: boolean) {
  let id: string;
  try {
    id = getRequiredEnv("STRIPE_ES_VAT_RATE_ID");
  } catch {
    return null;
  }
  if (!/^txr_[a-zA-Z0-9]+$/.test(id)) return null;
  const rate = await stripe.taxRates.retrieve(id);
  return isValidEsVatRate(rate, livemode) ? rate : null;
}
