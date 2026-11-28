/** Historical order inputs, never today's catalogue or active promotion. */
export type AdminShirtOrder = {
  status?: unknown;
  currency?: unknown;
  total_quantity?: unknown;
  subtotal?: unknown;
  total?: unknown;
  discount_amount?: unknown;
  product_subtotal?: unknown;
  shipping_amount?: unknown;
  shipping_method?: unknown;
  commerce_order_items?: unknown;
  [key: string]: unknown;
};

export type AdminShirtPricing = {
  productSubtotal: number;
  shippingAmount: number;
  productTotal: number;
  items: Array<{
    id?: string;
    sku?: string;
    quantity: number;
    originalUnitPrice: number;
    originalTotal: number;
    total: number;
    /** Null when the exact line total cannot be divided into whole cents. */
    unitPrice: number | null;
  }>;
};

const paidStatuses = new Set([
  "PAID", "READY_FOR_FULFILLMENT", "PREPARING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "REFUNDED",
]);
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
// Legacy order-item prices included this postage. Keep the historical amount
// here instead of depending on a catalogue constant that may change later.
const legacyPostagePerUnit = 300;

/**
 * Reconciles VAT-inclusive shirt sale prices to a confirmed order's charge.
 * Refunds are a separate event and do not rewrite the original sale price.
 * Invalid/inconsistent snapshots deliberately have no calculated sale price.
 */
export function adminShirtPricing(order: AdminShirtOrder | null | undefined): AdminShirtPricing | null {
  if (!order || typeof order.status !== "string" || !paidStatuses.has(order.status) ||
    order.currency !== "eur" || !cents(order.total_quantity) || order.total_quantity < 1 ||
    !cents(order.subtotal) || !cents(order.total) || !cents(order.discount_amount) ||
    !Number.isSafeInteger(order.total + order.discount_amount) || order.total + order.discount_amount !== order.subtotal ||
    !Array.isArray(order.commerce_order_items) || !order.commerce_order_items.length) return null;

  const legacy = order.shipping_method === null || order.shipping_method === undefined;
  if (!legacy && (typeof order.shipping_method !== "string" || !["standard", "priority"].includes(order.shipping_method))) return null;
  const shippingAmount = order.shipping_amount ?? (legacy ? order.total_quantity * legacyPostagePerUnit : null);
  if (!cents(shippingAmount) || shippingAmount > order.total ||
    (legacy && shippingAmount !== order.total_quantity * legacyPostagePerUnit)) return null;

  const items: AdminShirtPricing["items"] = [];
  let quantity = 0, productSubtotal = 0;
  for (const item of order.commerce_order_items) {
    if (!item || typeof item !== "object" || item.currency !== "eur" ||
      !cents(item.quantity) || item.quantity < 1 || !cents(item.unit_price) || !cents(item.line_total) ||
      !Number.isSafeInteger(item.quantity * item.unit_price) || item.quantity * item.unit_price !== item.line_total) return null;
    const originalUnitPrice = item.unit_price - (legacy ? legacyPostagePerUnit : 0);
    if (originalUnitPrice <= 0) return null;
    const originalTotal = originalUnitPrice * item.quantity;
    quantity += item.quantity;
    productSubtotal += originalTotal;
    if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(productSubtotal)) return null;
    items.push({
      ...(typeof item.id === "string" ? { id: item.id } : {}),
      ...(typeof item.sku === "string" ? { sku: item.sku } : {}),
      quantity: item.quantity, originalUnitPrice, originalTotal, total: 0, unitPrice: null,
    });
  }
  if (quantity !== order.total_quantity || productSubtotal + shippingAmount !== order.subtotal ||
    (order.product_subtotal !== null && order.product_subtotal !== undefined && order.product_subtotal !== productSubtotal)) return null;

  const productTotal = order.total - shippingAmount;
  // Largest-remainder allocation keeps the total exact even for mixed sizes,
  // quantities and discounts that cannot be split evenly into unit cents.
  const denominator = BigInt(productSubtotal);
  const shares = items.map((item, index) => {
    const numerator = BigInt(productTotal) * BigInt(item.originalTotal);
    item.total = Number(numerator / denominator);
    return { index, remainder: numerator % denominator, key: `${item.sku ?? ""}\u0000${item.id ?? ""}` };
  });
  let remaining = productTotal - items.reduce((sum, item) => sum + item.total, 0);
  shares.sort((a, b) => a.remainder === b.remainder
    ? (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index)
    : a.remainder > b.remainder ? -1 : 1);
  for (const share of shares) {
    if (remaining === 0) break;
    items[share.index].total++;
    remaining--;
  }
  for (const item of items) item.unitPrice = item.total % item.quantity === 0 ? item.total / item.quantity : null;
  return { productSubtotal, shippingAmount, productTotal, items };
}
