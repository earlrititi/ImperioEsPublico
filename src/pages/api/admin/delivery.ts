import type { APIRoute } from "astro";
import { database, failure, limited, privateJson, requestBody, requireAdmin, rpc } from "../../../lib/reservations";
import { deliveryEventInput } from "../../../lib/post-delivery";
import { UUID } from "../../../lib/reservation-validation";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context); await limited(context.request, "admin_delivery_read", 90);
    const id = context.url.searchParams.get("id");
    if (!UUID.test(id ?? "")) throw Error("INVALID_INPUT");
    const db = await database();
    const events = await db.from("commerce_delivery_events").select("id,kind,package_index,package_count,source,evidence_ref,actor_id,occurred_at,created_at")
      .eq("order_id", id).order("occurred_at", { ascending: false }).limit(150);
    const jobs = await db.from("post_delivery_jobs").select("id,kind,status,due_at,sent_at,provider_id,provider_status,attempts,last_error")
      .eq("order_id", id).order("created_at");
    if (events.error || jobs.error) throw Error("DATABASE_UNAVAILABLE");
    return privateJson({ events: events.data, jobs: jobs.data, coverage: "Entregas acreditadas manualmente; transportista sin integración automática." });
  } catch (error) { return failure(error); }
};
export const POST: APIRoute = async context => {
  try {
    const user = await requireAdmin(context); await limited(context.request, "admin_delivery_write", 60);
    const body = await requestBody(context.request);
    if (!UUID.test(body.orderId ?? "")) throw Error("INVALID_INPUT");
    if (body.action === "pause") {
      await rpc("pause_post_delivery", { p_order: body.orderId, p_actor: user.id }); return privateJson({ ok: true });
    }
    if (!UUID.test(body.eventId ?? "")) throw Error("INVALID_INPUT");
    const event = deliveryEventInput(body);
    // Only the customer may attest their own receipt. Administrators record
    // carrier evidence, support or returns without impersonating that customer.
    if (event.kind === "customer_received") throw Error("FORBIDDEN");
    return privateJson(await rpc("record_commerce_delivery", { p_order: body.orderId, p_kind: event.kind, p_package_index: event.packageIndex,
      p_package_count: event.packageCount, p_occurred: event.occurredAt, p_evidence: event.evidence, p_actor: user.id,
      p_source: "admin_evidence", p_event: body.eventId }));
  } catch (error) { return failure(error); }
};
