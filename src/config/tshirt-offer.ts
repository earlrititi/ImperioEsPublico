import { TSHIRT_DISCOUNT_PERCENT } from "./commerce";

export { TSHIRT_DISCOUNT_PERCENT };
export function shirtOfferCopy(plan: "arcabucero" | "maestre_campo") {
  return `${plan === "arcabucero" ? 15 : 20}% de descuento en la camiseta. Un solo uso, sin acumular descuentos y con la suscripcion activa al comprar. Envio no incluido en el descuento.`;
}
export const TSHIRT_OFFER_COPY = "15% de descuento en la camiseta con Arcabucero y 20% con Maestre de Campo. Reserva tambien tu camiseta. Un solo uso, sin acumular descuentos y con la suscripcion activa al comprar.";

export function shirtDiscountPercent(subscription: { plan?: string | null; status?: string | null } | null | undefined): 0 | 15 | 20 {
  if (subscription?.status !== "active") return 0;
  return subscription.plan === "maestre_campo" ? 20 : subscription.plan === "arcabucero" ? 15 : 0;
}

export function qualifiesForTshirtOffer(subscription: { plan?: string | null; status?: string | null } | null | undefined) {
  return shirtDiscountPercent(subscription) > 0;
}
