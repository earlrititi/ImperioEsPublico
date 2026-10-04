import { TSHIRT_DISCOUNT_PERCENT } from "./commerce";

export { TSHIRT_DISCOUNT_PERCENT };
export const TSHIRT_OFFER_COPY = `${TSHIRT_DISCOUNT_PERCENT}% de descuento en la Camiseta Imperial al activar Arcabucero. Se aplica una sola vez al comprar con el mismo correo y con la suscripción activa.`;

export function qualifiesForTshirtOffer(subscription: { plan?: string | null; status?: string | null } | null | undefined) {
  return subscription?.plan === "arcabucero" && subscription.status === "active";
}
