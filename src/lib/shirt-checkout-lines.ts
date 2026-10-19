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

export function shirtCheckoutMessage(items: { sku: string; quantity: number }[]) {
  if (!items.length || items.length > 5) throw Error("INVALID_VARIANT");
  const seen = new Set<string>();
  const sizes = items.map(item => {
    const size = /^IE-CAMISETA-IMPERIAL-(S|M|L|XL|XXL)$/.exec(item.sku)?.[1];
    if (!size || seen.has(size) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw Error("INVALID_VARIANT");
    seen.add(size);
    return `${size} (${item.quantity})`;
  });
  return `Tallas: ${sizes.join(", ")}. Camiseta: 26,99 EUR. Envio: 3 EUR por unidad, desglosado por separado. IVA incluido. Los descuentos no reducen el envio. Se utilizara la direccion confirmada en tu reserva.`;
}
