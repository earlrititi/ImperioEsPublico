import type { APIRoute } from "astro";
import {
  authorizedReservation,
  failure,
  limited,
  privateJson,
  publicReservation,
  requestBody,
  reservationMode,
  rpc,
  readReservation,
  database,
} from "../../../lib/reservations";
import { drainCommerceMail } from "../../../lib/commerce-mail";
import { closeOpenReservationPayment } from "../../../lib/reservation-payment";
export const prerender = false;
export const POST: APIRoute = async (context) => {
  try {
    const body = await requestBody(context.request);
    await limited(context.request, "reservation_manage", 100);
    let r = await authorizedReservation(
      context,
      context.params.id ?? "",
      body.token,
    );
    if (body.action === "marketing-withdraw") {
      const { error } = await (await database()).from("reservations")
        .update({ marketing_consent: false, marketing_withdrawn_at: new Date().toISOString() }).eq("id", r.id);
      if (error) throw new Error("DATABASE_UNAVAILABLE");
      r = await readReservation(r.id);
    } else if (body.action === "cancel") {
      await closeOpenReservationPayment(r.id);
      await rpc("release_shirt_reservation", {
        p_id: r.id,
        p_status: "CANCELLED",
      });
      await drainCommerceMail(1).catch(() => {});
      r = await readReservation(r.id);
    } else if (body.action === "reset-payment") {
      await closeOpenReservationPayment(r.id);
      r = await readReservation(r.id);
    } else if (body.action !== "view") throw new Error("INVALID_INPUT");
    return privateJson({
      reservation: publicReservation(r),
      reservationMode: reservationMode(),
    });
  } catch (error) {
    return failure(error);
  }
};
