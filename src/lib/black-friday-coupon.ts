import type Stripe from "stripe";
import { blackFridayDiscount } from "../config/black-friday";

// The coupon is internal, scoped to the actual shirt product, and never accepted from a client.
// Keep the regular price and use the existing discount_amount reconciliation in Supabase.
export async function blackFridayCoupon(stripe: Stripe, productId: string, quantity: number, live: boolean) {
  const amount = blackFridayDiscount(quantity);
  const id = `imperio_bf2026_${quantity}_${productId}`;
  let coupon: Stripe.Coupon;
  try {
    coupon = await stripe.coupons.retrieve(id, { expand: ["applies_to"] });
  } catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
    coupon = await stripe.coupons.create({
      id, name: "Black Friday 2026 · Camiseta Imperial", duration: "once",
      amount_off: amount, currency: "eur", applies_to: { products: [productId] },
      expand: ["applies_to"],
    }, { idempotencyKey: id });
  }
  if (coupon.id !== id || !coupon.valid || coupon.livemode !== live ||
      coupon.duration !== "once" || coupon.amount_off !== amount || coupon.currency !== "eur" ||
      coupon.percent_off !== null || coupon.applies_to?.products.length !== 1 ||
      coupon.applies_to.products[0] !== productId)
    throw new Error("INVALID_PROMOTION_CONFIGURATION");
  return coupon.id;
}
