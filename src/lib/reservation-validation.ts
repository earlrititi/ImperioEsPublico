import { PROVINCES, SHIRT_FINAL_PRICE_CENTS } from "../config/commerce";

export type ShippingAddress = {
  name: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
};
export type ReservationItemInput = { sku: string; quantity: number };
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isMainlandAddress(value: unknown): value is ShippingAddress {
  if (!value || typeof value !== "object") return false;
  const a = value as ShippingAddress;
  return (
    a.country === "ES" &&
    typeof a.postalCode === "string" &&
    /^\d{5}$/.test(a.postalCode) &&
    !a.postalCode.endsWith("000") &&
    PROVINCES.some(([code]) => code === a.province) &&
    a.postalCode.startsWith(a.province) &&
    [a.name, a.line1, a.city].every(
      (x) => typeof x === "string" && x.trim().length >= 2,
    ) &&
    a.line1.trim().length >= 5 &&
    a.name.length <= 150 &&
    a.line1.length <= 200 &&
    a.city.length <= 100 &&
    typeof a.line2 === "string" &&
    a.line2.length <= 200
  );
}
export function parseReservationInput(value: unknown, maximum = 2) {
  if (!value || typeof value !== "object") throw new Error("INVALID_INPUT");
  const b = value as Record<string, any>;
  if (
    !UUID.test(b.requestId ?? "") ||
    b.accepted !== true ||
    (b.marketing !== undefined && typeof b.marketing !== "boolean")
  )
    throw new Error("INVALID_INPUT");
  if (
    !b.customer ||
    typeof b.customer.name !== "string" ||
    b.customer.name.trim().length < 2 ||
    b.customer.name.length > 150 ||
    typeof b.customer.email !== "string" ||
    b.customer.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.customer.email.trim())
  )
    throw new Error("INVALID_CUSTOMER");
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 5)
    throw new Error("INVALID_ITEMS");
  const items: ReservationItemInput[] = b.items
    .map((i: any) => {
      if (
        !i ||
        typeof i.sku !== "string" ||
        !/^IE-CAMISETA-IMPERIAL-(S|M|L|XL|XXL)$/.test(i.sku) ||
        !Number.isSafeInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > Math.floor(2147483647 / SHIRT_FINAL_PRICE_CENTS)
      )
        throw new Error("INVALID_QUANTITY");
      return { sku: i.sku, quantity: i.quantity };
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));
  if (
    new Set(items.map((i) => i.sku)).size !== items.length ||
    !Number.isSafeInteger(
      items.reduce((n, i) => n + i.quantity * SHIRT_FINAL_PRICE_CENTS, 0),
    ) ||
    items.reduce((n, i) => n + i.quantity * SHIRT_FINAL_PRICE_CENTS, 0) >
      2147483647
  )
    throw new Error("INVALID_ITEMS");
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 50)
    throw new Error("INVALID_CONFIGURATION");
  if (items.reduce((n, item) => n + item.quantity, 0) > maximum)
    throw new Error("MAX_RESERVATION_QUANTITY");
  return {
    requestId: b.requestId,
    customer: {
      name: b.customer.name.trim(),
      email: b.customer.email.trim().toLowerCase(),
    },
    marketing: b.marketing === true,
    items,
  };
}
