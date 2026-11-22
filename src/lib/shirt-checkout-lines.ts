import type Stripe from "stripe";
import { SHIRT_SHIPPING_PRICE_CENTS, shirtDeliveryOption, type ShirtDelivery } from "../config/commerce";

export function shirtCheckoutLines(priceId: string, taxId: string, items: { quantity: number }[], delivery?: ShirtDelivery): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const quantity = items.reduce((sum,item)=>sum+item.quantity,0);
  if (!items.length || items.some(item=>!Number.isSafeInteger(item.quantity)||item.quantity<1) || !Number.isSafeInteger(quantity)) throw new Error("INVALID_QUANTITY");
  const shirts = items.map(item => ({ price: priceId, quantity: item.quantity, tax_rates: [taxId] }));
  const option = shirtDeliveryOption(delivery);
  if (option?.amount === 0) return shirts;
  return [
    ...shirts,
    // Separate product so a shirt-only Stripe coupon cannot reduce postage.
    {price_data:{currency:"eur",unit_amount:option?.amount ?? SHIRT_SHIPPING_PRICE_CENTS,tax_behavior:"inclusive",
      product_data:{name:option?.label ?? "Envio Correos por camiseta - Peninsula"}},quantity: option ? 1 : quantity,tax_rates:[taxId]},
  ];
}

export function ownsShirtDiscount(user: { email?: string; email_confirmed_at?: string | null } | null,
  reservationEmail: string, purchaseEmail: string) {
  const normalize=(email:string)=>email.trim().toLowerCase();
  return Boolean(user?.email_confirmed_at && user.email && normalize(user.email)===normalize(reservationEmail) && normalize(user.email)===normalize(purchaseEmail));
}

export function shirtCheckoutMessage(items: { sku: string; quantity: number }[], delivery?: ShirtDelivery) {
  if (!items.length || items.length > 5) throw Error("INVALID_VARIANT");
  const seen = new Set<string>();
  const sizes = items.map(item => {
    const size = /^IE-CAMISETA-IMPERIAL-(S|M|L|XL|XXL)$/.exec(item.sku)?.[1];
    if (!size || seen.has(size) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw Error("INVALID_VARIANT");
    seen.add(size);
    return `${size} (${item.quantity})`;
  });
  const option = shirtDeliveryOption(delivery);
  const shipping = option ? `${option.label}. ${option.description}.` : "Envío: 3 EUR por unidad.";
  return `Tallas: ${sizes.join(", ")}. ${shipping} Se utilizará la dirección confirmada para el pedido.`;
}
