import { supabaseAdmin } from "./supabase/admin";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { shirtDiscountPercent } from "../config/tshirt-offer";
import { getRequiredEnv } from "./env";

export const TSHIRT_LEAD_SOURCE = "tshirt_20_popup";
export { TSHIRT_DISCOUNT_PERCENT } from "../config/commerce";

export async function ensureArcabuceroPromotion(email: string, name = "Arcabucero") {
  email = email.trim().toLowerCase();
  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin.from("subscriptions")
    .select("plan,status,stripe_subscription_id").eq("email", email)
    .in("status", ["active"]).order("created_at", { ascending: false });
  if (subscriptionError) throw new Error("DATABASE_UNAVAILABLE");
  const { stripe } = await import("./stripe");
  let percent: 0 | 15 | 20 = 0;
  for (const subscription of subscriptions ?? []) {
    if (!subscription.stripe_subscription_id) continue;
    try {
      const current = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      if (current.livemode !== /^(sk|rk)_live_/.test(getRequiredEnv("STRIPE_SECRET_KEY"))) continue;
      const verifiedPlan = current.metadata.plan;
      const candidate = shirtDiscountPercent({ plan: verifiedPlan, status: current.status });
      if (candidate > percent) percent = candidate;
    } catch (error) {
      if ((error as { code?: string }).code !== "resource_missing") throw error;
    }
  }
  if (!percent) return null;
  const plan = percent === 20 ? "maestre_campo" : "arcabucero";
  const COUPON_ID = `imperio_e_${plan}_camiseta_${percent}`;

  let { data: lead, error } = await supabaseAdmin.from("marketing_leads").select("*")
    .eq("source", TSHIRT_LEAD_SOURCE).eq("email", email).maybeSingle();
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  if (!lead) {
    const inserted = await supabaseAdmin.from("marketing_leads").upsert({
      email, name: name.slice(0, 150), source: TSHIRT_LEAD_SOURCE,
      privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy, marketing_version: null,
      // This record tracks the contractual discount, not newsletter consent.
      marketing_accepted_at: null,
    }, { onConflict: "email,source", ignoreDuplicates: true });
    if (inserted.error) throw new Error("DATABASE_UNAVAILABLE");
    const loaded = await supabaseAdmin.from("marketing_leads").select("*")
      .eq("source", TSHIRT_LEAD_SOURCE).eq("email", email).single();
    if (loaded.error) throw new Error("DATABASE_UNAVAILABLE");
    lead = loaded.data;
  }
  if (lead.redeemed_at) return null;

  const price = await stripe.prices.retrieve(getRequiredEnv("STRIPE_PRICE_CAMISETA_IMPERIAL"));
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  let coupon;
  try { coupon = await stripe.coupons.retrieve(COUPON_ID, { expand: ["applies_to"] }); }
  catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
    coupon = await stripe.coupons.create({ id: COUPON_ID, percent_off: percent,
      duration: "once", name: `${plan} - Camiseta Imperial ${percent}%`, applies_to: { products: [productId] },
      expand: ["applies_to"],
    }, { idempotencyKey: COUPON_ID });
  }
  if (!coupon.valid || coupon.percent_off !== percent || coupon.duration !== "once" ||
    coupon.applies_to?.products.length !== 1 || coupon.applies_to.products[0] !== productId)
    throw new Error("INVALID_PROMOTION_CONFIGURATION");
  if (lead.stripe_coupon_id === COUPON_ID && lead.stripe_promotion_code_id) return lead;
  const promotion = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id }, max_redemptions: 1,
    metadata: { leadId: lead.id, source: `${plan}_subscription` },
  }, { idempotencyKey: `shirt-${lead.id}-${COUPON_ID}` });
  const updated = await supabaseAdmin.from("marketing_leads").update({
    stripe_coupon_id: coupon.id, stripe_promotion_code_id: promotion.id, promotion_code: promotion.code,
    email_sent_at: null, updated_at: new Date().toISOString(),
  }).eq("id", lead.id).select("*").single();
  if (updated.error) throw new Error("DATABASE_UNAVAILABLE");
  return updated.data;
}

export async function sendArcabuceroDiscount(email: string, name?: string) {
  const lead = await ensureArcabuceroPromotion(email, name);
  if (!lead) return "unavailable";
  if (lead.email_sent_at) return "existing";
  const { sendTshirtDiscountEmail } = await import("./emails");
  const sent = await sendTshirtDiscountEmail({ to: email, name: lead.name, code: lead.promotion_code,
    percent: lead.stripe_coupon_id?.includes("maestre_campo") ? 20 : 15, reference: `${lead.id}-${lead.stripe_coupon_id}` });
  if (sent.error || !sent.data) throw new Error("EMAIL_DELIVERY_FAILED");
  const marked = await supabaseAdmin.from("marketing_leads").update({
    email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", lead.id);
  if (marked.error) throw new Error("DATABASE_UNAVAILABLE");
  return "sent";
}

export async function findActiveTshirtPromotion(email: string) {
  const data = await ensureArcabuceroPromotion(email);
  if (!data?.stripe_promotion_code_id || data.redeemed_at) return null;

  const { stripe } = await import("./stripe");
  const promotion = await stripe.promotionCodes.retrieve(data.stripe_promotion_code_id);
  if (!promotion.active || (promotion.max_redemptions !== null && promotion.times_redeemed >= promotion.max_redemptions)) return null;
  return { leadId: data.id, promotionCodeId: promotion.id };
}
