import { formatMoney, PROVINCES } from "../config/commerce";

export const ADMIN_NOTIFICATION_EMAIL = "earlrititi@gmail.com";

export function subscriptionNotification(invoice: {
  id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_address?: { line1?: string | null; line2?: string | null; postal_code?: string | null; city?: string | null; state?: string | null; country?: string | null } | null;
}, plan: string, interval: "month" | "year") {
  const a = invoice.customer_address;
  return {
    subject: `Nueva suscripcion: ${plan} (${interval === "year" ? "anual" : "mensual"})`,
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
