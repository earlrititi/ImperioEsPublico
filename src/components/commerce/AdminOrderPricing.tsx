import { formatMoney, shirtDeliveryOption } from "../../config/commerce";
import { adminShirtPricing, type AdminShirtOrder } from "../../lib/admin-shirt-pricing";

export function AdminSaleUnitPrices({ order }: { order: AdminShirtOrder }) {
  const pricing = adminShirtPricing(order);
  if (!pricing) return null;
  return <div class="commerce-sale-prices">
    {pricing.items.map((item, index) => <small key={item.id ?? index}>
      {item.sku}: {item.unitPrice === null
        ? `${formatMoney(item.total)} en ${item.quantity} camisetas`
        : `${formatMoney(item.unitPrice)} por camiseta`}
    </small>)}
  </div>;
}

export default function AdminOrderPricing({ order }: { order: AdminShirtOrder }) {
  const pricing = adminShirtPricing(order);
  if (!pricing) return <p>Desglose del precio de venta sin verificar.</p>;
  const delivery = shirtDeliveryOption(order.shipping_method);
  return <div class="commerce-order-pricing">
    <ul>
      {pricing.items.map((item, index) => <li key={item.id ?? index}>
        {item.sku} · {item.quantity} {item.quantity === 1 ? "camiseta" : "camisetas"} · {item.unitPrice === null
          ? `Total de venta: ${formatMoney(item.total)}`
          : `Precio de venta: ${formatMoney(item.unitPrice)} por camiseta`}
        {item.total !== item.originalTotal && <small>Antes del descuento: {formatMoney(item.originalUnitPrice)} por camiseta</small>}
      </li>)}
    </ul>
    <p>Camisetas antes de descuentos: {formatMoney(pricing.productSubtotal)}</p>
    <p>Descuento: {formatMoney(pricing.productSubtotal - pricing.productTotal)}</p>
    <p>Camisetas después de descuentos: {formatMoney(pricing.productTotal)}</p>
    <p>Envío: {formatMoney(pricing.shippingAmount)}{delivery ? ` · ${delivery.label}` : ""}</p>
    {delivery && <p>{delivery.description}</p>}
    <p><strong>Total cobrado: {formatMoney(pricing.productTotal + pricing.shippingAmount)}</strong></p>
    <p>IVA incluido.</p>
    {typeof order.refunded_amount === "number" && Number.isSafeInteger(order.refunded_amount) && order.refunded_amount >= 0
      && <p>Reembolsado: {formatMoney(order.refunded_amount)}</p>}
  </div>;
}
