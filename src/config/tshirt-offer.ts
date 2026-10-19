import { TSHIRT_DISCOUNT_PERCENT } from "./commerce";

export { TSHIRT_DISCOUNT_PERCENT };
export function shirtOfferCopy(plan: "arcabucero" | "maestre_campo") {
  return `${plan === "arcabucero" ? 15 : 20}% en la camiseta. Un uso con suscripcion activa. No acumulable; envio excluido.`;
}
export const TSHIRT_OFFER_COPY = "Camiseta: 15% con Arcabucero y 20% con Maestre de Campo. Un uso con suscripcion activa. No acumulable; envio excluido.";

export function shirtDiscountPercent(subscription: { plan?: string | null; status?: string | null } | null | undefined): 0 | 15 | 20 {
  if (subscription?.status !== "active") return 0;
  return subscription.plan === "maestre_campo" ? 20 : subscription.plan === "arcabucero" ? 15 : 0;
}

export function qualifiesForTshirtOffer(subscription: { plan?: string | null; status?: string | null } | null | undefined) {
  return shirtDiscountPercent(subscription) > 0;
}
