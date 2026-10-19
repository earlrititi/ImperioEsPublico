import { Resend } from "resend";
import { getRequiredEnv } from "./env";
import { transactionalTestMessage } from "./mail-delivery";

if (!import.meta.env.SSR) {
  throw new Error("resend can only be used on the server.");
}

export const resend = new Resend(getRequiredEnv("RESEND_API_KEY"));

// Explicit opt-in for isolated subscription/auth Test runs. Ordinary Live sends
// are unchanged; enabling the redirect with a Live Stripe key fails closed.
const testRecipient = (import.meta.env.TRANSACTIONAL_EMAIL_TEST_RECIPIENT ?? process.env.TRANSACTIONAL_EMAIL_TEST_RECIPIENT ?? "").trim();
if (testRecipient) {
  const stripeKey = getRequiredEnv("STRIPE_SECRET_KEY");
  const runId = import.meta.env.TRANSACTIONAL_EMAIL_TEST_RUN_ID ?? process.env.TRANSACTIONAL_EMAIL_TEST_RUN_ID ?? "";
  const send = resend.emails.send.bind(resend.emails);
  resend.emails.send = (message, options) => send(transactionalTestMessage(message, testRecipient, stripeKey, runId), options);
}
