import { supabaseAdmin } from "./supabase/admin";

export const TSHIRT_LEAD_SOURCE = "tshirt_20_popup";
export const TSHIRT_DISCOUNT_PERCENT = 20;

export async function findActiveTshirtPromotion(email: string) {
  const { data, error } = await supabaseAdmin
    .from("marketing_leads")
    .select("id,stripe_promotion_code_id,redeemed_at")
    .eq("source", TSHIRT_LEAD_SOURCE)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw new Error("DATABASE_UNAVAILABLE");
  if (!data?.stripe_promotion_code_id || data.redeemed_at) return null;

  const { stripe } = await import("./stripe");
  const promotion = await stripe.promotionCodes.retrieve(data.stripe_promotion_code_id);
  if (!promotion.active || (promotion.max_redemptions !== null && promotion.times_redeemed >= promotion.max_redemptions)) return null;
  return { leadId: data.id, promotionCodeId: promotion.id };
}
