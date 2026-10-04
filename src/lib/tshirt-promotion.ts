import { supabaseAdmin } from "./supabase/admin";
import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { qualifiesForTshirtOffer } from "../config/tshirt-offer";
import { getRequiredEnv } from "./env";
import { TSHIRT_DISCOUNT_PERCENT } from "../config/commerce";

export const TSHIRT_LEAD_SOURCE = "tshirt_20_popup";
export { TSHIRT_DISCOUNT_PERCENT } from "../config/commerce";
const COUPON_ID = "imperio_e_arcabucero_camiseta_15";

export async function ensureArcabuceroPromotion(email: string, name = "Arcabucero") {
  email = email.trim().toLowerCase();
  const { data: subscription, error: subscriptionError } = await supabaseAdmin.from("subscriptions")
    .select("plan,status,stripe_subscription_id").eq("email", email)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (subscriptionError) throw new Error("DATABASE_UNAVAILABLE");
  if (!subscription?.stripe_subscription_id || !qualifiesForTshirtOffer(subscription)) return null;
  const { stripe } = await import("./stripe");
  const current = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  if (current.status !== "active") return null;

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
  if (lead.stripe_coupon_id === COUPON_ID && lead.stripe_promotion_code_id) return lead;

  const price = await stripe.prices.retrieve(getRequiredEnv("STRIPE_PRICE_CAMISETA_IMPERIAL"));
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  let coupon;
  try { coupon = await stripe.coupons.retrieve(COUPON_ID); }
  catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
    coupon = await stripe.coupons.create({ id: COUPON_ID, percent_off: TSHIRT_DISCOUNT_PERCENT,
      duration: "once", name: "Arcabucero - Camiseta Imperial 15%", applies_to: { products: [productId] },
    }, { idempotencyKey: COUPON_ID });
  }
  if (!coupon.valid || coupon.percent_off !== TSHIRT_DISCOUNT_PERCENT || coupon.duration !== "once" ||
    coupon.applies_to?.products.length !== 1 || coupon.applies_to.products[0] !== productId)
    throw new Error("INVALID_PROMOTION_CONFIGURATION");
  const promotion = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id }, max_redemptions: 1,
    metadata: { leadId: lead.id, source: "arcabucero_subscription" },
  }, { idempotencyKey: `arcabucero-shirt-${lead.id}` });
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
    percent: TSHIRT_DISCOUNT_PERCENT, reference: lead.id });
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
