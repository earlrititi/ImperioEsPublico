import type { APIRoute } from "astro";
import { database, failure, getUser, limited, privateJson, requestBody, rpc } from "../../../lib/reservations";
import { getRequiredEnv } from "../../../lib/env";
import { deliveryEventInput, verifyReceiptCapability } from "../../../lib/post-delivery";
import { UUID } from "../../../lib/reservation-validation";
export const prerender = false;
export const POST: APIRoute = async context => {
  try {
    await limited(context.request, "customer_delivery_receipt", 30);
    const body = await requestBody(context.request), db = await database();
    let jobId: string | null = null, expires: string | null = null, orderId: string, userId: string | null = null;
    if (typeof body.token === "string" && body.token) {
      const capability = verifyReceiptCapability(body.token, getRequiredEnv("RESERVATION_TOKEN_SECRET"));
      const job = await db.from("post_delivery_jobs").select("order_id,kind,status,token_expires_at,token_used_at").eq("id", capability.jobId).maybeSingle();
      if (job.error || !job.data || job.data.kind !== "delivery_check" || job.data.status !== "sent" || job.data.token_used_at ||
        Date.parse(job.data.token_expires_at) !== Date.parse(capability.expires)) throw Error("NOT_FOUND");
      jobId = capability.jobId; expires = capability.expires; orderId = job.data.order_id;
    } else {
      const user = await getUser(context);
      if (!user || !user.email_confirmed_at || !UUID.test(body.orderId ?? "")) throw Error("NOT_FOUND");
      userId = user.id; orderId = body.orderId;
      const reservation = await db.from("reservations").select("id,customer_email").eq("order_id", orderId).eq("user_id", user.id).maybeSingle();
      if (reservation.error || !reservation.data || reservation.data.customer_email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) throw Error("NOT_FOUND");
    }
    const order = await db.from("commerce_orders").select("number,status,delivery_expected_packages,customer_received_at,carrier_delivered_at,delivery_issue_at")
      .eq("id", orderId).single();
    const events = await db.from("commerce_delivery_events").select("package_index,kind").eq("order_id", orderId).eq("kind", "customer_received").order("package_index");
    if (order.error || events.error) throw Error("DATABASE_UNAVAILABLE");
    if (body.action === "inspect") return privateJson({ order: order.data, receivedPackages: events.data.map(e => e.package_index) });
    if (!UUID.test(body.eventId ?? "")) throw Error("INVALID_INPUT");
    const event = deliveryEventInput({ ...body, occurredAt: new Date().toISOString() }, true);
    const result = await rpc("confirm_commerce_receipt", { p_order: orderId, p_job: jobId, p_expires: expires, p_user: userId,
      p_kind: event.kind, p_index: event.packageIndex, p_count: event.packageCount, p_event: body.eventId });
    return privateJson({ ok: true, ...result });
  } catch (error) { return failure(error); }
};
