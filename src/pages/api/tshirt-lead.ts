import type { APIRoute } from "astro";
import { LEGAL_DOCUMENT_VERSIONS } from "../../config/legal";
import { sendTshirtDiscountEmail } from "../../lib/emails";
import { consumeRateLimit } from "../../lib/rate-limit";
import { isAllowedRequestOrigin } from "../../lib/request-security";
import { supabaseAdmin } from "../../lib/supabase/admin";
import { TSHIRT_DISCOUNT_PERCENT, TSHIRT_LEAD_SOURCE } from "../../lib/tshirt-promotion";

export const prerender = false;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUPON_ID = "imperio_e_camiseta_15";
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `IMPERIO15-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

async function getCoupon(stripe: any) {
  try {
    const coupon = await stripe.coupons.retrieve(COUPON_ID);
    if (!coupon.valid || coupon.percent_off !== TSHIRT_DISCOUNT_PERCENT || coupon.duration !== "once") throw new Error("INVALID_PROMOTION_CONFIGURATION");
    return coupon;
  } catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
    return stripe.coupons.create({ id: COUPON_ID, percent_off: TSHIRT_DISCOUNT_PERCENT, duration: "once", name: "Camiseta Imperial - 15%", metadata: { source: TSHIRT_LEAD_SOURCE } });
  }
}

async function createPromotion(stripe: any, couponId: string, leadId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: couponId },
        code: randomCode(),
        max_redemptions: 1,
        restrictions: { first_time_transaction: true },
        metadata: { leadId, source: TSHIRT_LEAD_SOURCE },
      }, { idempotencyKey: `tshirt-lead-promotion-${leadId}` });
    } catch (error) {
      if ((error as { code?: string }).code !== "resource_already_exists" || attempt === 2) throw error;
    }
  }
  throw new Error("PROMOTION_UNAVAILABLE");
}

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedRequestOrigin(request, import.meta.env.PUBLIC_SITE_URL)) return json({ error: "Origen no permitido." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 8192) return json({ error: "Solicitud demasiado grande." }, 413);
  const allowed = await consumeRateLimit({ request, endpoint: "tshirt_lead", limit: 5, windowSeconds: 60 * 60 });
  if (!allowed) return json({ error: "Demasiados intentos. Inténtalo más tarde." }, 429);

  const body = await request.json().catch(() => null);
  const name = clean(body?.name, 150);
  const email = clean(body?.email, 254).toLowerCase();
  if (clean(body?.website, 120)) return json({ ok: true });
  if (name.length < 2 || !EMAIL.test(email) || body?.marketingAccepted !== true) return json({ error: "Revisa los campos y confirma el consentimiento." }, 400);

  let { data: lead, error } = await supabaseAdmin
    .from("marketing_leads")
    .select("*")
    .eq("email", email)
    .eq("source", TSHIRT_LEAD_SOURCE)
    .maybeSingle();
  if (error) return json({ error: "No se pudo guardar el registro." }, 503);

  if (!lead) {
    const inserted = await supabaseAdmin.from("marketing_leads").insert({
      name, email, source: TSHIRT_LEAD_SOURCE, privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
      marketing_version: LEGAL_DOCUMENT_VERSIONS.privacy,
    }).select("*").single();
    if (inserted.error || !inserted.data) return json({ error: "No se pudo guardar el registro." }, 503);
    lead = inserted.data;
  }

  if (lead.email_sent_at && lead.promotion_code) return json({ ok: true, existing: true });

  try {
    let promotionCode = lead.promotion_code as string | null;
    let promotionId = lead.stripe_promotion_code_id as string | null;
    let couponId = lead.stripe_coupon_id as string | null;
    if (!promotionCode || !promotionId || !couponId) {
      const { stripe } = await import("../../lib/stripe");
      const coupon = await getCoupon(stripe);
      const promotion = await createPromotion(stripe, coupon.id, lead.id);
      promotionCode = promotion.code;
      promotionId = promotion.id;
      couponId = coupon.id;
      const updated = await supabaseAdmin.from("marketing_leads").update({
        name, stripe_coupon_id: couponId, stripe_promotion_code_id: promotionId, promotion_code: promotionCode, updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      if (updated.error) throw new Error("DATABASE_UNAVAILABLE");
    }
    if (!promotionCode) throw new Error("PROMOTION_UNAVAILABLE");
    const { stripe } = await import("../../lib/stripe");
    const coupon = await stripe.coupons.retrieve(couponId!);
    if (!coupon.percent_off) throw new Error("INVALID_PROMOTION_CONFIGURATION");
    const delivered = await sendTshirtDiscountEmail({ to: email, name, code: promotionCode, percent: coupon.percent_off });
    if (delivered.error) throw new Error("EMAIL_DELIVERY_FAILED");
    const marked = await supabaseAdmin.from("marketing_leads").update({ email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", lead.id);
    if (marked.error) throw new Error("DATABASE_UNAVAILABLE");
    return json({ ok: true });
  } catch (failure) {
    console.error("T-shirt lead delivery failed:", failure instanceof Error ? failure.message : "unknown");
    return json({ error: "El registro se guardó, pero no pudimos enviar el correo. Inténtalo de nuevo." }, 502);
  }
};
