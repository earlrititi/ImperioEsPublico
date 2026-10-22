import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { clearAuthAnalytics } from "../../../lib/auth-analytics";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect, request }) => {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Forbidden", { status: 403 });
  const supabase = createSupabaseServerClient({ cookies, request });
  await supabase.auth.signOut();
  clearAuthAnalytics({ cookies, request });

  return redirect("/login", 303);
};
