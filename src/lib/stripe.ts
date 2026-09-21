import Stripe from "stripe";
import { getRequiredEnv } from "./env";

if (!import.meta.env.SSR) {
  throw new Error("stripe can only be used on the server.");
}

export const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-07-29.dahlia",
});
