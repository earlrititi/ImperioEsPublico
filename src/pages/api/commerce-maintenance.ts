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
import { closeOpenReservationPayment, shirtPaymentConfiguration } from "../../lib/reservation-payment";
import { readCampaign } from "../../lib/reservation-campaign";
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  try {
    const secret = optionalEnv("COMMERCE_JOB_SECRET");
    if (
      secret.length < 32 ||
      !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
    )
      throw new Error("FORBIDDEN");
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
    return privateJson({ expired, opened, ...(await drainCommerceMail(20)) });
  } catch (error) {
    return failure(error);
  }
};
