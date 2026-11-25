// Campaign window in mainland Spain (CET, UTC+1). Base Stripe/DB price stays unchanged.
export const BLACK_FRIDAY_CAMPAIGN = "black_friday_2026";
export const BLACK_FRIDAY_PATH = "/tienda/black-friday";
export const BLACK_FRIDAY_START = Date.parse("2026-11-25T00:00:00+01:00");
export const BLACK_FRIDAY_END = Date.parse("2026-12-01T00:00:00+01:00");
export const blackFridayActive = (now = Date.now()) => now >= BLACK_FRIDAY_START && now < BLACK_FRIDAY_END;

export const BLACK_FRIDAY_OFFER_START = Date.parse("2026-11-27T00:00:00+01:00");
export const BLACK_FRIDAY_UNIT_DISCOUNT = 400;
export const BLACK_FRIDAY_PRICE_CENTS = 2299;
export const BLACK_FRIDAY_PREVIOUS_PRICE_CENTS = 2699;
export const blackFridayOfferActive = (now = Date.now()) => now >= BLACK_FRIDAY_OFFER_START && now < BLACK_FRIDAY_END;
export const blackFridayDiscount = (quantity: number) => {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > Math.floor(2147483647 / BLACK_FRIDAY_PREVIOUS_PRICE_CENTS)) throw new Error("INVALID_QUANTITY");
  return quantity * BLACK_FRIDAY_UNIT_DISCOUNT;
};
export function blackFridayEligible(attemptCreatedAt: string | undefined, delivery: string | undefined, now = Date.now()) {
  const created = Date.parse(attemptCreatedAt ?? "");
  return (delivery === "standard" || delivery === "priority") && Number.isFinite(created) &&
    created <= now && blackFridayOfferActive(created);
}
