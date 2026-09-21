import type { APIRoute } from "astro";
import { linkAnonymousConsents } from "../../../lib/legal-consents";
import { safeInternalPath } from "../../../lib/redirects";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, redirect, request, url }) => {
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"), "/cuenta");

  if (!code) {
    return redirect("/login?error=missing_code");
  }

  const supabase = createSupabaseServerClient({ cookies, request });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase auth callback failed", { code: error.code });
    return redirect("/login?error=auth_callback");
  }

  const pendingConsent = cookies.get("imperio_registration_consent")?.value;

  if (pendingConsent) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      try {
        await linkAnonymousConsents({ anonymousId: pendingConsent, userId: user.id });
        cookies.delete("imperio_registration_consent", { path: "/" });
      } catch (consentError) {
        console.error("Registration consent linking failed:", consentError);
      }
    }
  }

  return redirect(next);
};
