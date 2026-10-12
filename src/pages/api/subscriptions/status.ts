import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getSubscriptionByUserId, isActivePaidSubscription } from "../../../lib/subscriptions";

export const prerender = false;
export const GET: APIRoute = async ({ cookies, request }) => {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  try {
    const { data: { user }, error } = await createSupabaseServerClient({ cookies, request }).auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") throw error;
    if (!user?.email_confirmed_at) return Response.json({ state: "sign_in" }, { headers });
    const subscription = await getSubscriptionByUserId(user.id);
    // Only the server-side record updated by the signed webhook can activate access.
    const active = isActivePaidSubscription({ plan: subscription?.plan, status: subscription?.status });
    return Response.json({ state: active ? "active" : "pending" }, { headers });
  } catch {
    return Response.json({ error: "No se pudo comprobar el acceso. No repitas el pago." }, { status: 503, headers });
  }
};
