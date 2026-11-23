export const COMMERCIAL_FAMILIES = ["checkout", "cart", "viewed_product", "welcome", "editorial", "post_delivery_loyalty", "site"] as const;
export type CommercialFamily = typeof COMMERCIAL_FAMILIES[number];
export const COMMERCIAL_LABELS: Record<CommercialFamily, string> = {
  checkout: "Checkout", cart: "Carrito", viewed_product: "Producto", welcome: "Bienvenida",
  editorial: "Editorial y campañas", post_delivery_loyalty: "Fidelización", site: "Visita genérica",
};
export type CommercialPause = { paused: boolean; kinds: CommercialFamily[] };
export type CrmHealth = { accepted: number; delivered: number; bounced: number; complained: number; failed: number };
export type CrmReport = {
  generated_at: string; period: string;
  audience: { captured: number; accounts: number; verified_accounts: number; verified_contacts: number; eligible: number; owner_declared: number; unsubscribed: number; blocked: number };
  branches: { kind: CommercialFamily; pending: number; accepted: number; delivered: number; clicked: number; bounced: number; complained: number; review: number; suppressed: number }[];
  commerce: { paid_orders: number; collected_cents: number; refund_cents: number; net_collected_cents: number; buyers: number; repeat_buyers: number; recorded_invoice_gross_cents: number };
  health_24h: CrmHealth;
  policy: CommercialPause & { frequency_enabled: boolean; daily_limit: number; daily_hours: number; weekly_limit: number; weekly_hours: number };
};
export function validateCommercialPause(input: unknown): { expected: CommercialPause; paused: boolean; kinds: CommercialFamily[] } {
  const body = input as { expected?: CommercialPause; paused?: unknown; kinds?: unknown } | null;
  const validKinds = (value: unknown): value is CommercialFamily[] => Array.isArray(value) && value.length <= 7 &&
    new Set(value).size === value.length && value.every(kind => COMMERCIAL_FAMILIES.includes(kind));
  if (!body || typeof body.paused !== "boolean" || !validKinds(body.kinds) ||
    typeof body.expected?.paused !== "boolean" || !validKinds(body.expected?.kinds)) throw Error("INVALID_INPUT");
  return { expected: { paused: body.expected.paused, kinds: body.expected.kinds }, paused: body.paused, kinds: [...body.kinds].sort() };
}
/** Operational warnings, never proof of delivery, causal attribution or a winner. */
export function crmAlerts(health: CrmHealth) {
  const alerts: string[] = [];
  if (health.complained > 0) alerts.push("Hay reclamaciones de spam en las últimas 24 horas. Revisa y pausa las familias afectadas.");
  if (health.bounced > 0 && (health.accepted < 20 || health.bounced / health.accepted >= 0.02))
    alerts.push("Hay rebotes que requieren revisar destinatarios y supresiones.");
  if (health.failed > 0) alerts.push("Hay envíos fallidos o pendientes de revisión; conserva su clave antes de reintentar.");
  if (health.accepted >= 20 && health.delivered / health.accepted < 0.7)
    alerts.push("Menos del 70 % tiene entrega confirmada. Revisa el retraso y la recepción de eventos antes de atribuirlo a entregabilidad.");
  return alerts;
}

const experiment = (id: string, hypothesis: string, variants: string[], metric: string) => ({ id, hypothesis, variants, metric,
  status: "Propuesto; sin asignación ni envíos", minimumPerArm: 4000,
  stop: "Cualquier queja, baja superior al 1 % o rebotes superiores al 2 %: pausar y revisar. No declarar ganador sin muestra y análisis prefijados." });
export const CRM_EXPERIMENTS = [
  experiment("checkout-delay", "Dar más tiempo reduce fricción sin perder conversión.", ["1 hora (control)", "3 horas"], "Compra pagada conciliada tras clic identificado, ventana de 7 días"),
  experiment("checkout-length", "Una sola recuperación conserva el resultado con menos presión.", ["Secuencia actual", "Solo primer recordatorio"], "Ingreso neto por destinatario asignado, 7 días"),
  experiment("help-cta", "El CTA de ayuda resuelve dudas antes de comprar.", ["CTA actual", "CTA de ayuda propuesto"], "Compra pagada conciliada por asignación, 7 días"),
  experiment("editorial-copy", "El contenido histórico mejora la relación sin aumentar bajas.", ["Texto actual", "Variante histórica propuesta"], "Clic confirmado y bajas, 7 días"),
  experiment("welcome-segment", "Una bienvenida segmentada mejora la activación editorial.", ["Bienvenida actual", "Variante segmentada propuesta"], "Lectura identificada con permiso de analítica, 14 días"),
  experiment("loyalty-content", "El contenido editorial aporta más valor que pedir reseña.", ["Reseña voluntaria actual", "Contenido editorial propuesto"], "Interacción autorizada y recompra neta, 30 días"),
];
