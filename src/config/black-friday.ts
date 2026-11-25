// Campaign window in mainland Spain (CET, UTC+1). No price or shipping overrides.
export const BLACK_FRIDAY_CAMPAIGN = "black_friday_2026";
export const BLACK_FRIDAY_PATH = "/tienda/black-friday";
export const BLACK_FRIDAY_START = Date.parse("2026-11-25T00:00:00+01:00");
export const BLACK_FRIDAY_END = Date.parse("2026-12-01T00:00:00+01:00");
export const blackFridayActive = (now = Date.now()) => now >= BLACK_FRIDAY_START && now < BLACK_FRIDAY_END;
