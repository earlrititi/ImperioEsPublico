import type { APIRoute } from "astro";
import { SITE } from "../../../config/site";
import { handleAuthMailRequest } from "../../../lib/auth-mail-hook";
import {
  createCorporateMailClient,
  sendCorporateMail,
} from "../../../lib/customer-mail-service";
import { optionalEnv, rpc } from "../../../lib/reservations";
import { transactionalTestMessage } from "../../../lib/mail-delivery";

export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  const secret = optionalEnv("SUPABASE_AUTH_EMAIL_HOOK_SECRET");
  const idempotencySecret = optionalEnv("AUTH_MAIL_IDEMPOTENCY_SECRET");
  const apiKey = optionalEnv("RESEND_API_KEY");
  // Keep SMTP active until the signed hook, its ledger and secrets are ready.
  if (!secret || idempotencySecret.length < 32 || !apiKey)
    return Response.json(
      { error: { http_code: 503, message: "AUTH_MAIL_NOT_CONFIGURED" } },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  let client: ReturnType<typeof createCorporateMailClient> | undefined;
  return handleAuthMailRequest(request, {
    secret,
    idempotencySecret,
    siteUrl: optionalEnv("PUBLIC_SITE_URL") || SITE.url,
    from: `Imperio Español <${SITE.contactEmail}>`,
    replyTo: SITE.contactEmail,
    transformMessage: (message) =>
      transactionalTestMessage(
        message,
        optionalEnv("TRANSACTIONAL_EMAIL_TEST_RECIPIENT"),
        optionalEnv("STRIPE_SECRET_KEY"),
        optionalEnv("TRANSACTIONAL_EMAIL_TEST_RUN_ID"),
      ),
    claim: async (input) =>
      (await rpc("claim_customer_mail", input))?.[0] ?? null,
    send: (message, options) => {
      client ??= createCorporateMailClient(apiKey);
      return sendCorporateMail(client, message, options, { audit: false });
    },
    complete: async (id, claim, providerId) => {
      if (
        (await rpc("complete_customer_mail", {
          p_id: id,
          p_claim: claim,
          p_provider: providerId,
        })) !== true
      )
        throw Error("AUTH_MAIL_CLAIM_LOST");
    },
    fail: async (id, claim, code) => {
      await rpc("fail_customer_mail", {
        p_id: id,
        p_claim: claim,
        p_code: code,
      });
    },
  });
};
