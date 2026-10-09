const publicPages = /^\/(?:$|(?:instagram|tienda|reservas|suscribirse|precios|manifiesto|papeles-y-tratados|archivo|ensayos|efemerides|presente|sobre-nosotros|contacto|comunidad|foro|rutas|biblioteca|autores|legal)(?:\/[a-z0-9-]+)?\/?$)/;
export function validInteraction(value: unknown): value is { page: string; target: string; event: string } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const checkoutPages=/^\/checkout\/(?:arcabucero-(?:monthly|annual)|maestre-campo-(?:monthly|annual))\/?$/;
  return typeof v.page === "string" && v.page.length <= 200 && (publicPages.test(v.page)||checkoutPages.test(v.page)) &&
    !v.page.startsWith("/reservas/gestionar") &&
    typeof v.target === "string" && /^[a-z0-9:_/-]{1,120}$/.test(v.target) &&
    ["page_view", "click", "scroll_50", "scroll_90"].includes(String(v.event));
}
