import { formatMoney, PROVINCES } from "../config/commerce";

export const ADMIN_NOTIFICATION_EMAIL = "earlrititi@gmail.com";

export function paidOrderNotification(order: {
  number: string; customer_name: string; customer_email: string; customer_phone?: string | null;
  shipping_address: { name?: string; line1?: string; line2?: string; postalCode?: string; city?: string; province?: string };
  total_quantity: number; total: number; currency: string; paid_at: string; status: string; refunded_amount?: number;
  commerce_order_items: { size: string; quantity: number; product_name: string }[];
}) {
  const a = order.shipping_address;
  if (!a?.line1 || !a.postalCode || !a.city || !a.province || !order.customer_name || !order.customer_email ||
    order.currency !== "eur" || !Number.isInteger(order.total) || order.total <= 0 || !Number.isFinite(Date.parse(order.paid_at)) ||
    !order.commerce_order_items.length || order.commerce_order_items.some(item => !item.size || !Number.isInteger(item.quantity) || item.quantity < 1) ||
    order.commerce_order_items.reduce((sum, item) => sum + item.quantity, 0) !== order.total_quantity) throw Error("ORDER_NOTICE_DATA_INCOMPLETE");
  return {
    subject: `Pedido pagado de camisetas: ${order.number}`,
    text: ["PAGO CONFIRMADO - CAMISETA IMPERIAL", `Pedido: ${order.number}`,
      `Fecha del pago: ${new Date(order.paid_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} (hora peninsular)`,
      `Nombre: ${order.customer_name}`, `Correo: ${order.customer_email}`,
      order.customer_phone ? `Telefono: ${order.customer_phone}` : null,
      `Destinatario: ${a.name || order.customer_name}`, `Direccion de envio: ${a.line1}`,
      a.line2 ? `Direccion adicional: ${a.line2}` : null, `Codigo postal: ${a.postalCode}`, `Localidad: ${a.city}`,
      `Provincia: ${PROVINCES.find(([code]) => code === a.province)?.[1] ?? a.province}`, "Pais: Espana",
      `Cantidad total de camisetas: ${order.total_quantity}`,
      ...order.commerce_order_items.map(item => `${item.product_name} - Talla ${item.size}: ${item.quantity}`),
      `Total pagado: ${formatMoney(order.total)} (IVA incluido)`, `Estado actual del pedido: ${order.status}`,
      order.refunded_amount ? `Importe reembolsado: ${formatMoney(order.refunded_amount)}` : null,
      "Aviso administrativo de un pedido pagado. No es una reserva ni un nuevo cobro.",
    ].filter(Boolean).join("\n"),
  };
}

export function leadNotification(params: {
  kind: "registration" | "manifesto" | "newsletter" | "subscription_interest";
  email: string; name?: string; plan?: string;
}) {
  const label = params.kind === "newsletter" ? "Solicitud de newsletter y PDF" : params.kind === "manifesto" ? "Solicitud del manifiesto"
    : params.kind === "subscription_interest" ? "Checkout de suscripción pendiente de pago" : "Registro gratuito PIQUERO (no es una suscripción de pago)";
  return {
    subject: `${label}: Imperio Español`,
    text: [label, `Nombre: ${params.name || "No facilitado"}`, `Correo: ${params.email}`,
      params.plan ? `Plan: ${params.plan}` : null,
      params.kind === "subscription_interest" ? "El pago todavía no está confirmado." : null,
      params.kind === "registration" ? "La cuenta puede estar pendiente de confirmar el correo. No se ha cobrado una suscripción." : null,
    ].filter(Boolean).join("\n"),
  };
}

export function subscriptionNotification(invoice: {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_address?: { line1?: string | null; line2?: string | null; postal_code?: string | null; city?: string | null; state?: string | null; country?: string | null } | null;
}, plan: string, interval: "month" | "year") {
  const a = invoice.customer_address;
  return {
    subject: `Suscripcion confirmada - pago recibido: ${plan} (${interval === "year" ? "anual" : "mensual"})`,
    text: [
      "Nueva suscripcion con pago confirmado",
      `Nombre: ${invoice.customer_name || "No facilitado"}`,
      `Correo: ${invoice.customer_email || "No facilitado"}`,
      `Plan: ${plan}`,
      `Periodicidad: ${interval === "year" ? "Anual" : "Mensual"}`,
      `Direccion de facturacion: ${a ? [a.line1, a.line2, a.postal_code, a.city, a.state, a.country].filter(Boolean).join(", ") : "No facilitada"}`,
      `Factura: ${invoice.id}`,
    ].join("\n"),
  };
}

export function reservationNotification(r: {
  number: string; status: string; customer_name: string; customer_email: string;
  shipping_address?: { name?: string; line1?: string; line2?: string; postalCode?: string; city?: string; province?: string } | null;
  reservation_items: { size: string; quantity: number }[];
  total_price_snapshot: number;
}) {
  const a = r.shipping_address;
  return {
    subject: `Nueva ${r.status === "WAITLIST" ? "solicitud en lista de espera" : "reserva de camisetas"}: ${r.number}`,
    text: [
      `Referencia: ${r.number}`,
      `Nombre: ${r.customer_name}`,
      `Correo: ${r.customer_email}`,
      `Direccion de envio: ${a ? [a.name, a.line1, a.line2, a.postalCode, a.city, PROVINCES.find(([code]) => code === a.province)?.[1] ?? a.province, "Espana"].filter(Boolean).join(", ") : "No facilitada"}`,
      `Cantidad de camisetas: ${r.reservation_items.reduce((total, item) => total + item.quantity, 0)}`,
      ...r.reservation_items.map(item => `Talla ${item.size}: ${item.quantity}`),
      `Total informativo: ${formatMoney(r.total_price_snapshot)}`,
      r.status === "WAITLIST" ? "Lista de espera, sin stock asignado." : "Prerreserva registrada.",
      "No se ha realizado ningun cobro.",
    ].join("\n"),
  };
}
