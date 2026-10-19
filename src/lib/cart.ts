import { SHIRT_FINAL_PRICE_CENTS } from "../config/commerce";

export const CART_KEY = "imperio_cart";
export const CART_MAX_AGE = 7 * 86400;
export const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type ShirtSize = typeof SHIRT_SIZES[number];
export type CartItem = { size: ShirtSize; quantity: number };
const maxUnits = Math.floor(2147483647 / SHIRT_FINAL_PRICE_CENTS);

export function validCart(value: unknown): value is CartItem[] {
  if (!Array.isArray(value) || value.length > 5) return false;
  const sizes = new Set<string>();
  let total = 0;
  for (const item of value) {
    if (!item || typeof item !== "object" || Object.keys(item).some(k => !["size", "quantity"].includes(k)) ||
      !SHIRT_SIZES.includes(item.size) || sizes.has(item.size) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return false;
    sizes.add(item.size); total += item.quantity;
    if (total > maxUnits) return false;
  }
  return true;
}
export function changeCart(items: CartItem[], size: ShirtSize, quantity: number): CartItem[] {
  if (!validCart(items) || !SHIRT_SIZES.includes(size) || !Number.isSafeInteger(quantity) || quantity < 0) throw Error("INVALID_CART");
  const next = items.filter(item => item.size !== size);
  if (quantity) next.push({ size, quantity });
  next.sort((a,b) => SHIRT_SIZES.indexOf(a.size) - SHIRT_SIZES.indexOf(b.size));
  if (!validCart(next)) throw Error("INVALID_CART");
  return next;
}
export function readCart(): CartItem[] {
  try {
    const raw = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith(`${CART_KEY}=`));
    const parsed = JSON.parse(decodeURIComponent(raw?.slice(CART_KEY.length + 1) ?? "null"));
    if (!validCart(parsed?.items) || !Number.isFinite(parsed.expires) || parsed.expires <= Date.now() || parsed.expires > Date.now() + CART_MAX_AGE * 1000 + 1000) return [];
    return parsed.items;
  } catch { return []; }
}
export function saveCart(items: CartItem[]): void {
  if (!validCart(items)) throw Error("INVALID_CART");
  const domain = ["imperioes.com", "www.imperioes.com"].includes(location.hostname) ? "; Domain=imperioes.com" : "";
  const value = encodeURIComponent(JSON.stringify({ items, expires: Date.now() + CART_MAX_AGE * 1000 }));
  document.cookie = `${CART_KEY}=${items.length ? value : ""}; Max-Age=${items.length ? CART_MAX_AGE : 0}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}${domain}`;
  window.dispatchEvent(new Event("imperio:cart"));
}
