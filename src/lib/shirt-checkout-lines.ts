import type Stripe from "stripe";
import { SHIRT_SHIPPING_PRICE_CENTS } from "../config/commerce";

export function shirtCheckoutLines(priceId: string, taxId: string, items: { quantity: number }[]): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const quantity = items.reduce((sum,item)=>sum+item.quantity,0);
  if (!items.length || items.some(item=>!Number.isSafeInteger(item.quantity)||item.quantity<1) || !Number.isSafeInteger(quantity)) throw new Error("INVALID_QUANTITY");
  return [
    ...items.map(item=>({price:priceId,quantity:item.quantity,tax_rates:[taxId]})),
    // Separate product so a shirt-only Stripe coupon cannot reduce postage.
    {price_data:{currency:"eur",unit_amount:SHIRT_SHIPPING_PRICE_CENTS,tax_behavior:"inclusive",
      product_data:{name:"Envio Correos por camiseta - Peninsula"}},quantity,tax_rates:[taxId]},
  ];
}

export function ownsShirtDiscount(user: { email?: string; email_confirmed_at?: string | null } | null,
  reservationEmail: string, purchaseEmail: string) {
  const normalize=(email:string)=>email.trim().toLowerCase();
  return Boolean(user?.email_confirmed_at && user.email && normalize(user.email)===normalize(reservationEmail) && normalize(user.email)===normalize(purchaseEmail));
}
