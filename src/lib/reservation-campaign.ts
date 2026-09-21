import { database } from "./reservations";

export async function readCampaign() {
  const { data, error } = await (await database()).from("commerce_campaign")
    .select("*").eq("id", "shirt-first-edition").single();
  if (error || !data) throw new Error("DATABASE_UNAVAILABLE");
  return data;
}

export function campaignAcceptsReservations(c: { reservations_open_at: string | null; purchase_activated: boolean }, now = Date.now()) {
  return !c.purchase_activated && (!c.reservations_open_at || Date.parse(c.reservations_open_at) <= now);
}
