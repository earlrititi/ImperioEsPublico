import { getRequiredEnv } from "./env";

export type CheckoutPlan =
  | "arcabucero-monthly"
  | "arcabucero-annual"
  | "maestre-campo-monthly"
  | "maestre-campo-annual";

type CheckoutPlanConfig = {
  priceEnvName: string;
  plan: "arcabucero" | "maestre_campo";
  billingInterval: "month" | "year";
  label: string;
  displayName: string;
  expectedUnitAmount: number;
};

export const checkoutPlans: Record<CheckoutPlan, CheckoutPlanConfig> = {
  "arcabucero-monthly": {
    priceEnvName: "STRIPE_PRICE_ARCABUCERO_MONTHLY",
    plan: "arcabucero",
    billingInterval: "month",
    label: "ARCABUCERO mensual",
    displayName: "ARCABUCERO",
    expectedUnitAmount: 199,
  },
  "arcabucero-annual": {
    priceEnvName: "STRIPE_PRICE_ARCABUCERO_ANNUAL",
    plan: "arcabucero",
    billingInterval: "year",
    label: "ARCABUCERO anual",
    displayName: "ARCABUCERO",
    expectedUnitAmount: 1799,
  },
  "maestre-campo-monthly": {
    priceEnvName: "STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY",
    plan: "maestre_campo",
    billingInterval: "month",
    label: "MAESTRE DE CAMPO mensual",
    displayName: "MAESTRE DE CAMPO",
    expectedUnitAmount: 399,
  },
  "maestre-campo-annual": {
    priceEnvName: "STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL",
    plan: "maestre_campo",
    billingInterval: "year",
    label: "MAESTRE DE CAMPO anual",
    displayName: "MAESTRE DE CAMPO",
    expectedUnitAmount: 3799,
  },
};

export function getCheckoutPlan(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  if (!Object.hasOwn(checkoutPlans, input)) {
    return null;
  }

  const plan = checkoutPlans[input as CheckoutPlan];

  return {
    ...plan,
    priceId: getRequiredEnv(plan.priceEnvName),
  };
}

export function isCheckoutPriceValid(
  price: { active: boolean; currency: string; unit_amount: number | null; type: string;
    recurring?: { interval: string; interval_count: number } | null },
  plan: CheckoutPlanConfig
) {
  return price.active && price.currency === "eur" && price.type === "recurring" &&
    price.unit_amount === plan.expectedUnitAmount &&
    price.recurring?.interval === plan.billingInterval && price.recurring.interval_count === 1;
}
