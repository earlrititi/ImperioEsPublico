import type { APIRoute } from "astro";
import {
  limited,
  newChallenge,
  privateJson,
  failure,
} from "../../../lib/reservations";
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  try {
    await limited(request, "reservation_challenge", 20);
    return privateJson({ challenge: newChallenge() });
  } catch (error) {
    return failure(error);
  }
};
