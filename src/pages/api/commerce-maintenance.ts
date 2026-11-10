import type { APIRoute } from "astro";
import {
  database,
  failure,
  optionalEnv,
  privateJson,
  rpc,
  safeEqual,
} from "../../lib/reservations";
import { drainCommerceMail } from "../../lib/commerce-mail";
import { drainAdminMail,reconcileAdminDelivery } from "../../lib/admin-mail";
import { closeOpenReservationPayment, shirtPaymentConfiguration } from "../../lib/reservation-payment";
import { readCampaign } from "../../lib/reservation-campaign";
import { drainPaidOrderAdminMail, reconcilePaidOrderAdminDelivery } from "../../lib/paid-order-admin-mail";
import { automationDeliveryReceipts, runMarketingAutomations } from "../../lib/automation-worker";
import { runPostDelivery } from "../../lib/post-delivery-worker";
import {runSubscriptionNotices} from "../../lib/marketing-contacts";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const secret = optionalEnv("COMMERCE_JOB_SECRET");
    if (
      secret.length < 32 ||
      !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
    )
      throw new Error("FORBIDDEN");
    const paidOrderAdminMail = await drainPaidOrderAdminMail(10);
    const paidOrderAdminDelivery = await reconcilePaidOrderAdminDelivery(10);
    const { data, error } = await (
      await database()
    )
      .from("reservations")
      .select("id")
      .in("status", ["RESERVED", "PURCHASE_AVAILABLE", "PAYMENT_FAILED", "PAYMENT_PENDING"])
      .lte("expires_at", new Date().toISOString())
      .limit(100);
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    let expired = 0;
    for (const r of data ?? []) {
      try {
        await closeOpenReservationPayment(r.id);
        if (
          await rpc("release_shirt_reservation", {
            p_id: r.id,
            p_status: "EXPIRED",
          })
        )
          expired++;
      } catch (error) {
        if (!(error instanceof Error) || !["INVALID_STATE", "PAYMENT_IN_PROGRESS"].includes(error.message))
          throw error;
      }
    }
    let opened = 0;
    const c = await readCampaign();
    if (c.purchase_activated && (!c.purchase_open_at || Date.parse(c.purchase_open_at) <= Date.now())) {
      await shirtPaymentConfiguration();
      const { data: pending, error: pendingError } = await (await database()).from("reservations")
        .select("id").eq("status", "RESERVED").order("created_at").limit(100);
      if (pendingError) throw new Error("DATABASE_UNAVAILABLE");
      for (const r of pending ?? []) if (await rpc("open_shirt_purchase", { p_id: r.id })) opened++;
    }
    const adminDelivery=await reconcileAdminDelivery(10);
    const commerceMail = await drainCommerceMail(20), adminMail = await drainAdminMail(10);
    // Marketing runs after transactional work and cannot fail the order-mail maintenance.
    let marketing;
    try { marketing = { ...(await runMarketingAutomations(3)), delivery: await automationDeliveryReceipts(3),subscriptionNotices:await runSubscriptionNotices(3) }; }
    catch { marketing = { failed: true }; console.error("MARKETING_MAINTENANCE_FAILED"); }
    let postDelivery: unknown;
    try { postDelivery = await runPostDelivery(3); }
    catch { postDelivery = { failed: true }; console.error("POST_DELIVERY_MAINTENANCE_FAILED"); }
    let seo: unknown = { enabled: false };
    if (process.env.SEO_ENGINE_ENABLED === "true") {
      try { const { runSeoWorker } = await import("../../lib/seo-engine-worker"); seo = await runSeoWorker(); }
      catch { seo = { failed: true }; console.error("SEO_MAINTENANCE_FAILED"); }
    }
    return privateJson({ expired, opened, paidOrderAdminMail, paidOrderAdminDelivery, ...commerceMail, adminMail, adminDelivery, marketing, postDelivery, seo });
  } catch (error) {
    return failure(error);
  }
};
