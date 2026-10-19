import { createHash } from "node:crypto";
import { SHIRT_FINAL_PRICE_CENTS, SHIRT_SHIPPING_PRICE_CENTS } from "../config/commerce";
import { SHIRT_SIZES } from "./cart";
import type { GooglePurchase } from "./ecommerce";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const cents = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;

// Call only after authorizedReservation. The canonical order is created by the
// signed, reconciled payment webhook, never by the success-page URL.
export function confirmedShirtPurchase(reservation: any, now = Date.now()): GooglePurchase | null {
  const order = reservation?.commerce_orders;
  const items = order?.commerce_order_items;
  const paidAt = Date.parse(order?.paid_at);
  if (reservation?.status !== "CONVERTED_TO_ORDER" || !order ||
    !uuid.test(order.id) || order.id !== reservation.order_id || order.reservation_id !== reservation.id ||
    !/^cs_live_[A-Za-z0-9]+$/.test(order.stripe_checkout_session_id) ||
    order.stripe_checkout_session_id !== reservation.stripe_checkout_session_id ||
    !/^pi_[A-Za-z0-9]+$/.test(order.stripe_payment_intent_id) ||
    order.stripe_payment_intent_id !== reservation.stripe_payment_intent_id ||
    order.currency !== "eur" || order.status === "REFUNDED" || order.refunded_amount !== 0 ||
    !Number.isFinite(paidAt) || paidAt > now || now - paidAt > 24 * 60 * 60 * 1000 ||
    !Array.isArray(items) || items.length < 1 || items.length > SHIRT_SIZES.length) return null;

  const sizes = new Set<string>();
  let quantity = 0;
  for (const item of items) {
    if (!SHIRT_SIZES.includes(item.size) || sizes.has(item.size) ||
      item.sku !== `IE-CAMISETA-IMPERIAL-${item.size}` || item.currency !== "eur" ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
      item.unit_price !== SHIRT_FINAL_PRICE_CENTS || item.line_total !== item.quantity * item.unit_price) return null;
    sizes.add(item.size);
    quantity += item.quantity;
  }
  const gross = quantity * SHIRT_FINAL_PRICE_CENTS;
  const shippingGross = quantity * SHIRT_SHIPPING_PRICE_CENTS;
  if (order.total_quantity !== quantity || order.subtotal !== gross ||
    !cents(order.total) || !cents(order.discount_amount) || !cents(order.vat_amount) ||
    order.total + order.discount_amount !== gross || order.total <= shippingGross || order.vat_amount >= order.total) return null;

  // Stripe records the actual inclusive VAT on the entire charge. Apportion
  // that tax to the separately priced shipping; the three amounts reconcile
  // exactly to the charged total, including subscriber/popup discounts.
  const shippingTax = Math.round(order.vat_amount * shippingGross / order.total);
  const shipping = shippingGross - shippingTax;
  const value = order.total - order.vat_amount - shipping;
  if (value <= 0 || shipping < 0) return null;
  let allocated = 0;
  const sorted = [...items].sort((a, b) => SHIRT_SIZES.indexOf(a.size) - SHIRT_SIZES.indexOf(b.size));
  return {
    transaction_id: `ie_${createHash("sha256").update(`shirt-order:${order.id}`).digest("hex")}`,
    currency: "EUR", value: value / 100, tax: order.vat_amount / 100, shipping: shipping / 100,
    items: sorted.map((item, index) => {
      const line = index === sorted.length - 1 ? value - allocated : Math.round(value * item.quantity / quantity);
      allocated += line;
      return { item_id: item.sku, item_name: "Camiseta Imperial", item_variant: item.size,
        item_brand: "Imperio E", item_category: "Camisetas", quantity: item.quantity, price: line / item.quantity / 100 };
    }),
  };
}
