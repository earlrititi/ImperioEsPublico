import type { APIRoute } from "astro";
import {
  database,
  failure,
  limited,
  privateJson,
  requestBody,
  requireAdmin,
  reservationMode,
  rpc,
} from "../../lib/reservations";
import { closeOpenReservationPayment, shirtPaymentConfiguration } from "../../lib/reservation-payment";
import { drainCommerceMail } from "../../lib/commerce-mail";
import { UUID } from "../../lib/reservation-validation";
import { readCampaign } from "../../lib/reservation-campaign";
export const prerender = false;
export const GET: APIRoute = async (context) => {
  try {
    await requireAdmin(context);
    const page = Math.max(
      0,
      Math.min(100000, Number(context.url.searchParams.get("page")) || 0),
    );
    const view = ["orders", "waitlist"].includes(context.url.searchParams.get("view") ?? "")
      ? context.url.searchParams.get("view")! : "reservations";
    const db = await database();
    const inventory = await db
      .from("product_variants")
      .select(
        "id,sku,name,color,physical_stock,promotional_stock,reserved_stock,sold_stock,available_stock",
      )
      .order("sku");
    let query = db
      .from(view === "orders" ? "commerce_orders" : "reservations")
      .select(
        view === "orders"
          ? "*,commerce_order_items(*)"
          : "id,number,customer_name,customer_email,customer_phone,shipping_address,status,total_quantity,total_price_snapshot,created_at,expires_at,marketing_consent,stripe_checkout_session_id,order_id,reservation_items(*)",
        { count: "exact" },
      )
      .order("created_at", { ascending: view === "waitlist" });
    if (view === "waitlist") query = query.eq("status", "WAITLIST");
    else if (view === "reservations") query = query.neq("status", "WAITLIST");
    const list = await query.range(page * 20, page * 20 + 19);
    const waiting = await db.from("reservations").select("id", { count: "exact", head: true }).eq("status", "WAITLIST");
    const expired = await db.from("reservations").select("id", { count: "exact", head: true }).eq("status", "EXPIRED");
    const stats = await rpc("commerce_summary");
    if (inventory.error || list.error || waiting.error || expired.error) throw new Error("DATABASE_UNAVAILABLE");
    return privateJson({
      inventory: inventory.data,
      rows: list.data,
      count: list.count,
      page,
      view,
      stats,
      campaign: await readCampaign(),
      waiting: waiting.count,
      expired: expired.count,
      legalPending: [],
      reservationMode: reservationMode(),
    });
  } catch (error) {
    return failure(error);
  }
};
export const POST: APIRoute = async (context) => {
  try {
    const body = await requestBody(context.request);
    const user = await requireAdmin(context);
    await limited(context.request, "commerce_admin", 120);
    if (body.action === "mail") return privateJson(await drainCommerceMail(20));
    if (body.action === "campaign-configure") {
      const c = body.config;
      if (!c || (c.max_reservation_quantity !== null && (!Number.isInteger(c.max_reservation_quantity) || c.max_reservation_quantity < 1 || c.max_reservation_quantity > 50)) ||
        !Number.isInteger(c.purchase_window_hours) || c.purchase_window_hours < 1 || c.purchase_window_hours > 8760 ||
        (c.edition_total !== null && (!Number.isInteger(c.edition_total) || c.edition_total < 1)) ||
        [c.reservations_open_at, c.purchase_open_at].some((date) => date !== null && (typeof date !== "string" || !Number.isFinite(Date.parse(date)))))
        throw new Error("INVALID_INPUT");
      await rpc("configure_shirt_campaign", { p_config: c, p_actor: user.id });
      return privateJson({ ok: true });
    }
    if (body.action === "campaign-activate") {
      await shirtPaymentConfiguration();
      await rpc("activate_shirt_campaign", { p_actor: user.id });
      return privateJson({ ok: true });
    }
    if (body.action === "invite-next") {
      if (!/^IE-CAMISETA-IMPERIAL-(S|M|L|XL|XXL)$/.test(body.sku ?? "")) throw new Error("INVALID_INPUT");
      const c = await readCampaign();
      if (c.purchase_activated) await shirtPaymentConfiguration();
      const id = await rpc("invite_next_shirt_waitlist", { p_sku: body.sku, p_actor: user.id });
      await drainCommerceMail(2).catch(() => {});
      return privateJson({ id });
    }
    if (!UUID.test(body.id ?? "")) throw new Error("INVALID_INPUT");
    if (["cancel", "open", "resend"].includes(body.action)) {
      if (body.action === "cancel") await closeOpenReservationPayment(body.id);
      if (body.action === "open") await shirtPaymentConfiguration();
      if (body.action === "resend" && !UUID.test(body.requestId ?? ""))
        throw new Error("INVALID_INPUT");
      await rpc("admin_commerce_action", {
        p_id: body.id,
        p_action: body.action,
        p_actor: user.id,
        p_request: body.requestId ?? null,
      });
    } else if (body.action === "fulfillment") {
      if (
        typeof body.carrier !== "string" ||
        typeof body.tracking !== "string" ||
        body.carrier.length > 80 ||
        body.tracking.length > 150
      )
        throw new Error("INVALID_INPUT");
      await rpc("update_commerce_fulfillment", {
        p_id: body.id,
        p_status: body.status,
        p_carrier: body.carrier,
        p_tracking: body.tracking,
        p_actor: user.id,
      });
    } else throw new Error("INVALID_INPUT");
    await drainCommerceMail(2).catch(() => {});
    return privateJson({ ok: true });
  } catch (error) {
    return failure(error);
  }
};
