import type { APIRoute } from "astro";
import { RESERVATION_TERMS_VERSION } from "../../../config/commerce";
import { LEGAL_DOCUMENT_VERSIONS } from "../../../config/legal";
import { parseReservationInput } from "../../../lib/reservation-validation";
import {
  failure,
  getUser,
  hash,
  limited,
  managementLink,
  optionalEnv,
  privateJson,
  readReservation,
  requestBody,
  reservationMode,
  reservationToken,
  rpc,
  sign,
  verifyChallenge,
} from "../../../lib/reservations";
import { drainCommerceMail } from "../../../lib/commerce-mail";
import { readCampaign } from "../../../lib/reservation-campaign";
export const prerender = false;
export const POST: APIRoute = async (context) => {
  try {
    const body = await requestBody(context.request);
    if (!reservationMode() && body.waitlist !== true) throw new Error("RESERVATION_MODE");
    await limited(context.request, "reservation_create", 12);
    const campaign = await readCampaign();
    const parsed = parseReservationInput(body, campaign.max_reservation_quantity);
    const waitlist = body.waitlist === true;
    if (waitlist && (parsed.items.length !== 1 || parsed.items[0].quantity !== 1))
      throw new Error("INVALID_ITEMS");
    if (
      body.website ||
      !verifyChallenge(body.challenge, body.nonce, parsed.requestId)
    )
      throw new Error("ANTI_BOT");
    const allowedEmail = await rpc("consume_rate_limit", {
      p_endpoint: "reservation_email",
      p_bucket_key: sign(`email:${parsed.customer.email}`),
      p_window_seconds: 3600,
      p_limit: 12,
    });
    if (!allowedEmail) throw new Error("RATE_LIMITED");
    const user = await getUser(context);
    const hours = Number(optionalEnv("RESERVATION_EXPIRATION_HOURS") || 0);
    if (!Number.isInteger(hours) || hours < 0 || hours > 8760)
      throw new Error("INVALID_CONFIGURATION");
    if ((body.expirationHours ?? 0) !== hours) throw new Error("INVALID_INPUT");
    const id = await rpc("create_shirt_reservation", {
      p_request_id: parsed.requestId,
      p_payload_hash: hash(
        JSON.stringify({ ...parsed, waitlist, userId: user?.id ?? null }),
      ),
      p_token_hash: hash(reservationToken(parsed.requestId)),
      p_user_id: user?.id ?? null,
      p_customer: parsed.customer,
      p_address: parsed.address,
      p_marketing: parsed.marketing,
      p_waitlist: waitlist,
      p_items: parsed.items,
      p_terms: RESERVATION_TERMS_VERSION,
      p_privacy: LEGAL_DOCUMENT_VERSIONS.privacy,
      p_expires_hours: hours,
    });
    const r = await readReservation(id);
    await drainCommerceMail(1).catch(() => {});
    return privateJson({ id, number: r.number, url: managementLink(r) }, 201);
  } catch (error) {
    return failure(error);
  }
};
