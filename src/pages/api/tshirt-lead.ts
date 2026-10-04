import type { APIRoute } from "astro";
import { consumeRateLimit } from "../../lib/rate-limit";
import { isAllowedRequestOrigin } from "../../lib/request-security";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getSubscriptionByUserId } from "../../lib/subscriptions";
import { qualifiesForTshirtOffer } from "../../config/tshirt-offer";
import { sendArcabuceroDiscount } from "../../lib/tshirt-promotion";

export const prerender = false;
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAllowedRequestOrigin(request, import.meta.env.PUBLIC_SITE_URL)) return json({ error: "Origen no permitido." }, 403);
  if (!await consumeRateLimit({ request, endpoint: "tshirt_lead", limit: 5, windowSeconds: 3600 }))
    return json({ error: "Demasiados intentos. Inténtalo más tarde." }, 429);
  try {
    const supabase = createSupabaseServerClient({ cookies, request });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) return json({ error: "Inicia sesión para recibir tu descuento." }, 401);
    const subscription = await getSubscriptionByUserId(user.id);
    if (!qualifiesForTshirtOffer(subscription))
      return json({ error: "El descuento requiere una suscripción Arcabucero activa." }, 403);
    const state = await sendArcabuceroDiscount(user.email, user.user_metadata?.full_name);
    if (state === "unavailable") return json({ error: "El descuento ya se ha utilizado o la suscripción ha dejado de estar activa." }, 409);
    return json({ ok: true, existing: state === "existing" });
  } catch {
    return json({ error: "No se pudo enviar el descuento. Inténtalo de nuevo." }, 502);
  }
};
