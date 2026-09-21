import type { APIRoute } from "astro";
import {
  database,
  failure,
  getUser,
  privateJson,
} from "../../../lib/reservations";
export const prerender = false;
export const GET: APIRoute = async (context) => {
  try {
    const user = await getUser(context);
    if (!user) throw new Error("FORBIDDEN");
    const { data, error } = await (
      await database()
    )
      .from("reservations")
      .select("id,number,status,total_quantity,total_price_snapshot,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    return privateJson({ reservations: data });
  } catch (error) {
    return failure(error);
  }
};
