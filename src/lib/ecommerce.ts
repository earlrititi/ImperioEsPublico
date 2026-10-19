import { validCart, type CartItem } from "./cart";
import { SHIRT_PRODUCT_PRICE_CENTS } from "../config/commerce";

export type CommerceEvent = "view_item" | "add_to_cart" | "remove_from_cart" | "view_cart" | "begin_checkout" | "add_shipping_info";

const subscriptionItems = {
  "arcabucero-monthly": { item_id: "IE-ARCABUCERO-MONTHLY", item_name: "Arcabucero mensual" },
  "arcabucero-annual": { item_id: "IE-ARCABUCERO-ANNUAL", item_name: "Arcabucero anual" },
  "maestre-campo-monthly": { item_id: "IE-MAESTRE-MONTHLY", item_name: "Maestre de Campo mensual" },
  "maestre-campo-annual": { item_id: "IE-MAESTRE-ANNUAL", item_name: "Maestre de Campo anual" },
} as const;

export function subscriptionPurchaseItem(variant: string, price: number) {
  if (!Object.hasOwn(subscriptionItems, variant)) return null;
  return { ...subscriptionItems[variant as keyof typeof subscriptionItems], item_variant: variant,
    item_brand: "Imperio E" as const, item_category: "Suscripciones" as const, quantity: 1, price };
}

export interface GooglePurchase {
  transaction_id: string;
  currency: "EUR";
  value: number;
  tax: number;
  shipping: number;
  items: { item_id: string; item_name: string; item_variant: string;
    item_brand: "Imperio E"; item_category: "Camisetas" | "Suscripciones"; price: number; quantity: number }[];
}

// Explicit projection: no order/customer fields can leak through object spread.
export function googlePurchasePayload(input: unknown): GooglePurchase | null {
  const p = input as GooglePurchase | null;
  if (!p || !/^ie_[a-f0-9]{64}$/.test(p.transaction_id) || p.currency !== "EUR" ||
    ![p.value, p.tax, p.shipping].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1_000_000) ||
    p.value <= 0 || !Array.isArray(p.items) || !p.items.length) return null;
  if (p.items.length === 1 && p.items[0]?.item_category === "Suscripciones") {
    const item = p.items[0], safe = subscriptionPurchaseItem(item.item_variant, p.value);
    if (!safe || item.item_id !== safe.item_id || item.quantity !== 1 || item.price !== p.value || p.shipping !== 0) return null;
    return { transaction_id: p.transaction_id, currency: "EUR", value: p.value, tax: p.tax, shipping: 0, items: [safe] };
  }
  if (!validCart(p.items.map(i => ({ size: i?.item_variant, quantity: i?.quantity })))) return null;
  if (p.items.some(i => i.item_id !== `IE-CAMISETA-IMPERIAL-${i.item_variant}` ||
    typeof i.price !== "number" || !Number.isFinite(i.price) || i.price <= 0 || i.price >= 1_000_000) ||
    Math.abs(p.items.reduce((sum, i) => sum + i.quantity * i.price, 0) - p.value) > 0.005) return null;
  return { transaction_id: p.transaction_id, currency: "EUR", value: p.value, tax: p.tax, shipping: p.shipping,
    items: p.items.map(i => ({ item_id: i.item_id, item_name: "Camiseta Imperial", item_variant: i.item_variant,
      item_brand: "Imperio E", item_category: "Camisetas", price: i.price, quantity: i.quantity })) };
}

export function ecommercePayload(event: CommerceEvent, items: CartItem[]) {
  if (!["view_item", "add_to_cart", "remove_from_cart", "view_cart", "begin_checkout", "add_shipping_info"].includes(event) || !validCart(items) || !items.length) return null;
  return { currency: "EUR", value: items.reduce((sum, item) => sum + item.quantity * SHIRT_PRODUCT_PRICE_CENTS, 0) / 100,
    items: items.map(item => ({ item_id: `IE-CAMISETA-IMPERIAL-${item.size}`, item_name: "Camiseta Imperial", item_variant: item.size,
      item_brand: "Imperio E", item_category: "Camisetas", price: SHIRT_PRODUCT_PRICE_CENTS / 100, quantity: item.quantity })),
    ...(event === "add_shipping_info" ? { shipping_tier: "Correos - Peninsula" } : {}),
  };
}
