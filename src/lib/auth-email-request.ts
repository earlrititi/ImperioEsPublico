import type { APIContext } from "astro";
import { authError, readAuthForm, validEmail } from "./auth-forms";
import { createSupabaseServerClient } from "./supabase/server";
import { getRequiredEnv } from "./env";
import { authCaptchaToken, isAuthCaptchaFailure } from "./auth-captcha";

export async function requestAuthEmail(context: APIContext, purpose: "recovery" | "confirmation") {
  const route = purpose === "recovery" ? "/recuperar-contrasena" : "/confirmar-correo";
  try {
    const form = await readAuthForm(context.request, `auth_${purpose}`);
    const email = (form.get("email") ?? "").trim().toLowerCase();
    if (!validEmail(email)) throw new Error("validation");
    const captchaToken = authCaptchaToken(form);
    const supabase = createSupabaseServerClient(context);
    const next = purpose === "recovery" ? "/cuenta/contrasena" : "/cuenta";
    const redirectTo = `${getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "")}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const result = purpose === "recovery"
      ? await supabase.auth.resetPasswordForEmail(email, { redirectTo, captchaToken })
      : await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo, captchaToken } });
    if (isAuthCaptchaFailure(result.error)) throw new Error("captcha");
    if (result.error) console.error("Auth email request failed", { purpose, code: result.error.code });
    // Same response for missing, confirmed and existing accounts: no enumeration.
    return context.redirect(`${route}?sent=1`, 303);
  } catch (error) { return context.redirect(`${route}?error=${authError(error)}`, 303); }
}
