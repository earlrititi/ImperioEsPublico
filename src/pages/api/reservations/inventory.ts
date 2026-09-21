import type { APIRoute } from "astro";
import {
  database,
  failure,
  optionalEnv,
  privateJson,
  reservationMode,
} from "../../../lib/reservations";
import { SHIRT_FINAL_PRICE_CENTS } from "../../../config/commerce";
import { readCampaign, campaignAcceptsReservations } from "../../../lib/reservation-campaign";
export const prerender = false;
export const GET: APIRoute = async () => {
  try {
    const db = await database();
    const campaign = await readCampaign();
    const { data: product, error: pError } = await db
      .from("products")
      .select("id")
      .eq("slug", "camiseta-imperial")
      .single();
    if (pError || !product) throw new Error("DATABASE_UNAVAILABLE");
    const { data, error } = await db
      .from("product_variants")
      .select("sku,name,color,available_stock")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("name");
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    const { data: price, error: priceError } = await db
      .from("product_prices")
      .select("amount")
      .eq("product_id", product.id)
      .eq("currency", "eur")
      .lte("starts_at", new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();
    if (priceError || price?.amount !== SHIRT_FINAL_PRICE_CENTS)
      throw new Error("PRICE_CONFIGURATION_REQUIRED");
    const expirationHours = Number(
      optionalEnv("RESERVATION_EXPIRATION_HOURS") || 0,
    );
    if (
      !Number.isInteger(expirationHours) ||
      expirationHours < 0 ||
      expirationHours > 8760
    )
      throw new Error("INVALID_CONFIGURATION");
    return privateJson({
      variants: data,
      unitPrice: price.amount,
      reservationMode: reservationMode() && campaignAcceptsReservations(campaign),
      campaign,
      expirationHours,
    });
  } catch (error) {
    return failure(error);
  }
};
