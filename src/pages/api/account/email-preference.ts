import type { APIRoute } from "astro";
import { privateAuthHeaders, readAuthForm } from "../../../lib/auth-forms";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { setEmailPreference } from "../../../lib/email-preferences";

export const prerender = false;
export const POST: APIRoute = async ({ request, cookies }) => {
  const headers = new Headers(); privateAuthHeaders(headers);
  let outcome = "error";
  try {
    const form = await readAuthForm(request, "account_email_preference");
    if (!["yes", "no"].includes(form.get("enabled") ?? "")) throw Error("INVALID_INPUT");
    const { data: { user }, error } = await createSupabaseServerClient({ request, cookies }).auth.getUser();
    if (error || !user?.email_confirmed_at) throw Error("UNAUTHORIZED");
    const result = await setEmailPreference(user.id, form.get("enabled") === "yes");
    outcome = result.active ? "on" : "off";
  } catch { /* A failed request never displays a successful preference change. */ }
  headers.set("Location", `/cuenta?comunicaciones=${outcome}#comunicaciones`);
  return new Response(null, { status: 303, headers });
};
