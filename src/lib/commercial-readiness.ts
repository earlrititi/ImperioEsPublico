import type { PaidPlanName } from "./subscriptions";

export type PublishedContentTier = "piquero" | "arcabucero" | "maestre-de-campo";

export function isCheckoutModeEnabled(
  livemode: boolean | undefined,
  liveCheckoutSetting: string | undefined
) {
  return livemode === false || (livemode === true && liveCheckoutSetting === "true");
}

export function hasPublishedPaidContent(
  tiers: PublishedContentTier[],
  plan: PaidPlanName
) {
  if (plan === "arcabucero") {
    return tiers.includes("arcabucero");
  }

  return tiers.some((tier) => tier === "arcabucero" || tier === "maestre-de-campo");
}
