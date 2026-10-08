import type { APIRoute } from "astro";
import { failure, limited, privateJson, requireAdmin } from "../../../lib/reservations";
import { verifiedSubscriptions } from "../../../lib/subscription-reconciliation";
export const prerender = false;
export const GET: APIRoute = async context => {
  try {
    await requireAdmin(context);
    await limited(context.request, "admin_subscriptions", 20);
    return privateJson(await verifiedSubscriptions());
  } catch (error) { return failure(error); }
};
