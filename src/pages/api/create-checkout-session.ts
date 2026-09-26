import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { LEGAL_DOCUMENT_VERSIONS } from "../../config/legal";
import { hasPublishedPaidContent, isCheckoutModeEnabled } from "../../lib/commercial-readiness";
import { getPublishedArticleTiers } from "../../lib/article-content";
import { getRequiredEnv } from "../../lib/env";
import { recordLegalConsents } from "../../lib/legal-consents";
import { consumeRateLimit } from "../../lib/rate-limit";
import { isAllowedRequestOrigin } from "../../lib/request-security";
import { getCheckoutPlan, isCheckoutPriceValid } from "../../lib/stripe-prices";
import { getEsVatRate } from "../../lib/stripe-tax";
import { getSubscriptionByUserId, isActivePaidSubscription } from "../../lib/subscriptions";
import { createSupabaseServerClient } from "../../lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const prerender = false;

function siteUrl() {
  return getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
}

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const publicSiteUrl = siteUrl();

    if (!isAllowedRequestOrigin(request, publicSiteUrl)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > 8192) {
      return new Response(JSON.stringify({ error: "Solicitud demasiado grande" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowed = await consumeRateLimit({
      request,
      endpoint: "stripe_checkout",
      limit: 10,
      windowSeconds: 15 * 60,
    });

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intentalo mas tarde." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json().catch(() => null);
    const requestId = typeof body?.requestId === "string" ? body.requestId : "";
    const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId : "";
    const consents = body?.consents;

    if (
      !UUID_PATTERN.test(requestId) ||
      !UUID_PATTERN.test(anonymousId) ||
      consents?.terms !== true ||
      consents?.privacy !== true ||
      consents?.immediateAccess !== true ||
      consents?.withdrawalAcknowledgement !== true
    ) {
      return new Response(
        JSON.stringify({ error: "Debes confirmar todas las condiciones antes del pago." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (body?.product === "camiseta-imperial") {
      return new Response(JSON.stringify({ error: "LEGAL_PRODUCT_DATA_INCOMPLETE" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    const selectedPlan = getCheckoutPlan(body?.plan);

    if (!selectedPlan) {
      return new Response(JSON.stringify({ error: "Invalid plan or product" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const publishedTiers = [
      ...(await getCollection("articles")).map((entry) => entry.data.tier),
      ...getPublishedArticleTiers(),
    ];

    if (!hasPublishedPaidContent(publishedTiers, selectedPlan.plan)) {
      return new Response(JSON.stringify({ error: "SUBSCRIPTION_CONTENT_NOT_READY" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { stripe } = await import("../../lib/stripe");
    const price = await stripe.prices.retrieve(selectedPlan.priceId);

    if (!isCheckoutModeEnabled(price.livemode, import.meta.env.STRIPE_LIVE_CHECKOUT_ENABLED)) {
      return new Response(JSON.stringify({
        code: "LIVE_CHECKOUT_NOT_ENABLED",
        error: "La contratacion todavia no esta abierta.",
      }), {
        status: 409,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (!isCheckoutPriceValid(price, selectedPlan)) {
      return new Response(JSON.stringify({ error: "La configuracion del precio no es valida." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    const taxRate = await getEsVatRate(stripe, price.livemode);
    if (!taxRate) {
      return Response.json({ error: "Configuracion fiscal no disponible.", code: "TAX_CONFIGURATION_REQUIRED" }, { status: 409 });
    }

    const supabase = createSupabaseServerClient({ cookies, request });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError") {
      return Response.json({ error: "No se pudo verificar la cuenta." }, { status: 503 });
    }
    const existing = user ? await getSubscriptionByUserId(user.id) : null;
    if (existing && isActivePaidSubscription(existing)) {
      return Response.json({ error: "Ya tienes una suscripcion activa. Gestiona tu plan desde tu cuenta." }, { status: 409 });
    }
    let customerId: string | undefined;
    if (existing?.stripe_customer_id && existing.user_id === user?.id) {
      const customer = await stripe.customers.retrieve(existing.stripe_customer_id);
      if (customer.deleted || customer.livemode !== price.livemode ||
        (customer.metadata.userId && customer.metadata.userId !== user?.id)) {
        return Response.json({ error: "No se pudo verificar el cliente de facturacion." }, { status: 409 });
      }
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        locale: "es",
        billing_address_collection: "required",
        customer_update: customerId ? { address: "auto", name: "auto" } : undefined,
        client_reference_id: user?.id,
        customer: customerId,
        customer_email: customerId ? undefined : user?.email,
        automatic_tax: { enabled: false },
        payment_method_types: ["card"],
        line_items: [
          {
            price: selectedPlan.priceId,
            quantity: 1,
          },
        ],
        success_url: `${publicSiteUrl}/gracias?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicSiteUrl}/checkout/${body.plan}`,
        metadata: {
          termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
        },
        subscription_data: {
          default_tax_rates: [taxRate.id],
          metadata: {
            plan: selectedPlan.plan,
            billingInterval: selectedPlan.billingInterval,
            userId: user?.id ?? "",
          },
        },
      },
      { idempotencyKey: `checkout_${user?.id ?? anonymousId}_${body.plan}_${requestId}` }
    );

    if (session.status === "expired" || !session.url) {
      return Response.json({ error: "La sesion de pago ha caducado. Recarga la pagina para iniciar otra." }, { status: 409 });
    }

    try {
      const checkoutConsents = [
        { consentType: "terms", documentVersion: LEGAL_DOCUMENT_VERSIONS.terms },
        { consentType: "privacy_acknowledgement", documentVersion: LEGAL_DOCUMENT_VERSIONS.privacy },
        { consentType: "digital_content_immediate_access", documentVersion: LEGAL_DOCUMENT_VERSIONS.terms },
        { consentType: "digital_withdrawal_acknowledgement", documentVersion: LEGAL_DOCUMENT_VERSIONS.terms },
      ] as const;

      await recordLegalConsents(
        checkoutConsents.map(({ consentType, documentVersion }) => ({
          userId: user?.id ?? null,
          anonymousId,
          consentType,
          documentVersion,
          accepted: true,
          source: "checkout",
          contextType: "stripe_checkout_session",
          contextId: session.id,
          metadata: {
            plan: selectedPlan.plan,
            billingInterval: selectedPlan.billingInterval,
          },
        }))
      );
    } catch (consentError) {
      console.error("Checkout consent recording failed:", consentError);
      await stripe.checkout.sessions.expire(session.id).catch((expirationError) => {
        console.error("Checkout session expiration failed:", expirationError);
      });
      return new Response(JSON.stringify({ error: "No se pudo registrar el consentimiento." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-checkout-session error:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("Missing required environment variable:")
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing server configuration",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unable to create checkout session" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
