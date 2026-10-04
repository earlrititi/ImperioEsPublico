import type { APIRoute } from "astro";
import { readPublicInventory } from "../../../lib/public-inventory";
import { failure, privateJson } from "../../../lib/reservations";
export const prerender = false;
export const GET: APIRoute = async () => {
  try {
    return privateJson(await readPublicInventory());
  } catch (error) {
    return failure(error);
  }
};
