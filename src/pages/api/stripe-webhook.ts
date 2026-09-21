import type { APIRoute } from "astro";
import type Stripe from "stripe";
import { getRequiredEnv } from "../../lib/env";
import { handleReservationCheckout } from "../../lib/reservation-payment";
import { database, rpc } from "../../lib/reservations";
import {
  claimStripeEvent,
  completeStripeEvent,
  failStripeEvent,
} from "../../lib/stripe-events";
import {
  type BillingInterval,
  findUserIdByEmail,
  type PaidPlanName,
  upsertSubscription,
} from "../../lib/subscriptions";

export const prerender = false;

function getObjectId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function getPlanFromMetadata(metadata?: Stripe.Metadata | null): PaidPlanName | null {
  if (metadata?.plan === "arcabucero" || metadata?.plan === "maestre_campo") {
    return metadata.plan;
  }

  return null;
}

function getPlanLabel(plan: PaidPlanName) {
  return plan === "maestre_campo" ? "MAESTRE DE CAMPO" : "ARCABUCERO";
}

function getBillingInterval(metadata?: Stripe.Metadata | null): BillingInterval | null {
  if (metadata?.billingInterval === "month" || metadata?.billingInterval === "year") {
    return metadata.billingInterval;
  }

  return null;
}

function getPlanFromSubscription(subscription: Stripe.Subscription): PaidPlanName {
  const metadataPlan = getPlanFromMetadata(subscription.metadata);

  if (metadataPlan) {
    return metadataPlan;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const arcabuceroPrices = [
    import.meta.env.STRIPE_PRICE_ARCABUCERO_MONTHLY,
    import.meta.env.STRIPE_PRICE_ARCABUCERO_ANNUAL,
  ];
  const maestrePrices = [
    import.meta.env.STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY,
    import.meta.env.STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL,
  ];

  if (priceId && arcabuceroPrices.includes(priceId)) {
    return "arcabucero";
  }

  if (priceId && maestrePrices.includes(priceId)) {
    return "maestre_campo";
  }

  throw new Error(`Unknown Stripe subscription price: ${priceId ?? "missing"}`);
}

function getIntervalFromSubscription(subscription: Stripe.Subscription): BillingInterval {
  const metadataInterval = getBillingInterval(subscription.metadata);

  if (metadataInterval) {
    return metadataInterval;
  }

  return subscription.items.data[0]?.price.recurring?.interval === "year"
    ? "year"
    : "month";
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithLegacySubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const parentSubscription =
    invoice.parent?.type === "subscription_details"
      ? invoice.parent.subscription_details?.subscription
      : null;

  return getObjectId(parentSubscription ?? invoiceWithLegacySubscription.subscription);
}

async function safeFindUserIdByEmail(email: string | null) {
  if (!email) {
    return null;
  }

  try {
    return await findUserIdByEmail(email);
  } catch (error) {
    console.error("Stripe webhook profile lookup failed:", error);
    return null;
  }
}

async function safeSendWebhookEmail(
  label: string,
  sendEmail: () => Promise<unknown>
) {
  try {
    await sendEmail();
  } catch (error) {
    console.error(`Stripe webhook email failed (${label}):`, error);
  }
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];

  return {
    currentPeriodStart: firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null,
    currentPeriodEnd: firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null,
  };
}

function getSubscriptionPriceSummary(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price;

  if (!price?.unit_amount) {
    return "importe indicado en Stripe Checkout";
  }

  const amount = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unit_amount / 100);
  const interval = price.recurring?.interval === "year" ? "año" : "mes";

  return `${amount} por ${interval}`;
}

async function getCustomerEmail(customerId: string, stripe: Stripe) {
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  return customer.email ?? null;
}

async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  stripe: Stripe,
  forcedStatus?: string
) {
  const stripeCustomerId = getObjectId(subscription.customer);
  const email = stripeCustomerId
    ? await getCustomerEmail(stripeCustomerId, stripe)
    : null;
  const userId = subscription.metadata.userId || await safeFindUserIdByEmail(email);
  const plan = getPlanFromSubscription(subscription);
  const billingInterval = getIntervalFromSubscription(subscription);
  const { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriod(subscription);

  await upsertSubscription({
    userId,
    email,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    plan,
    billingInterval,
    status: forcedStatus ?? subscription.status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  return { email, plan, status: forcedStatus ?? subscription.status };
}

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
  const { stripe } = await import("../../lib/stripe");

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    // Signature errors can embed the raw payload; do not copy customer data into logs.
    console.error("Stripe webhook signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  const expectedLiveMode = /^(sk|rk)_live_/.test(getRequiredEnv("STRIPE_SECRET_KEY"));
  if (event.livemode !== expectedLiveMode) {
    return new Response("Stripe mode mismatch", { status: 400 });
  }
  const supportedEvents = [
    "checkout.session.completed", "customer.subscription.created",
    "customer.subscription.updated", "customer.subscription.deleted",
    "invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed",
    "checkout.session.expired", "payment_intent.payment_failed", "charge.refunded",
    "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  ];
  if (!supportedEvents.includes(event.type)) return Response.json({ received: true, ignored: true });

  try {
    const claimed = await claimStripeEvent({
      eventId: event.id,
      eventType: event.type,
    });

    if (!claimed) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (claimError) {
    console.error("Stripe webhook idempotency claim failed:", claimError);
    return new Response("Webhook idempotency unavailable", { status: 503 });
  }

  try {
    switch (event.type) {
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.reservationAttemptId) {
          const current = await stripe.checkout.sessions.retrieve(session.id);
          await handleReservationCheckout(current);
          break;
        }
        const subscriptionId = getObjectId(session.subscription);
        const email =
          session.customer_details?.email ?? session.customer_email ?? null;

        if (
          session.mode === "payment" &&
          session.metadata?.product === "camiseta-imperial"
        ) {
          if (email && session.payment_status === "paid") {
            const { sendMerchPurchaseEmail } = await import("../../lib/emails");
            await safeSendWebhookEmail("merchandise purchase", () => {
              return sendMerchPurchaseEmail({
                to: email,
                productName: "Camiseta Imperial",
                size: session.metadata?.size ?? "",
              });
            });
          }

          break;
        }

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const synced = await upsertFromSubscription(subscription, stripe);

          if (
            email &&
            (synced.status === "active" || synced.status === "trialing")
          ) {
            const { sendPaidWelcomeEmail } = await import("../../lib/emails");
            await safeSendWebhookEmail("paid welcome", () => {
              return sendPaidWelcomeEmail({
                to: email,
                planName: getPlanLabel(synced.plan),
                priceSummary: getSubscriptionPriceSummary(subscription),
                termsVersion: session.metadata?.termsVersion ?? "no registrada",
              });
            });
          }
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // Event snapshots can arrive after a newer update or cancellation.
        const snapshot = event.data.object as Stripe.Subscription;
        const subscription = await stripe.subscriptions.retrieve(snapshot.id);
        await upsertFromSubscription(subscription, stripe);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.reservationAttemptId) {
          const current = await stripe.checkout.sessions.retrieve(session.id);
          if (current.payment_status === 'paid') await handleReservationCheckout(current);
          else await rpc('close_shirt_payment', {p_attempt:session.metadata.reservationAttemptId,p_session:session.id,p_expired:current.status==='expired'});
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.reservationAttemptId) {
          const current = await stripe.checkout.sessions.retrieve(session.id);
          if (current.status === 'expired') await rpc('close_shirt_payment',{p_attempt:session.metadata.reservationAttemptId,p_session:session.id,p_expired:true});
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.reservationAttemptId) {
          const {data:a,error} = await (await database()).from('reservation_payment_attempts').select('stripe_session_id').eq('id',intent.metadata.reservationAttemptId).single();
          if (error || !a?.stripe_session_id) throw new Error('PAYMENT_ATTEMPT_NOT_READY');
          const current = await stripe.checkout.sessions.retrieve(a.stripe_session_id);
          if (current.payment_status !== 'paid') await rpc('close_shirt_payment',{p_attempt:intent.metadata.reservationAttemptId,p_session:current.id,p_expired:current.status==='expired'});
        }
        break;
      }
      case "charge.refunded": {
        const snapshot = event.data.object as Stripe.Charge;
        const current = await stripe.charges.retrieve(snapshot.id);
        const intent = getObjectId(current.payment_intent);
        if (intent) await rpc('record_commerce_refund',{p_intent:intent,p_refunded:current.amount_refunded});
        break;
      }

      case "customer.subscription.deleted": {
        const { email } = await upsertFromSubscription(
          event.data.object as Stripe.Subscription,
          stripe,
          "canceled"
        );

        if (email) {
          const { sendSubscriptionCancelledEmail } = await import("../../lib/emails");
          await safeSendWebhookEmail("subscription cancelled", () => {
            return sendSubscriptionCancelledEmail({ to: email });
          });
        }

        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertFromSubscription(subscription, stripe);
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getObjectId(invoice.customer);
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        let paymentStillDue = false;
        let customerEmail: string | null = null;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const synced = await upsertFromSubscription(subscription, stripe);
          customerEmail = synced.email;
          paymentStillDue = ["past_due", "unpaid", "incomplete"].includes(subscription.status);
        }

        if (customerId && paymentStillDue) {
          const email = customerEmail;

          if (email) {
            const { sendPaymentFailedEmail } = await import("../../lib/emails");
            await safeSendWebhookEmail("payment failed", () => {
              return sendPaymentFailedEmail({ to: email });
            });
          }
        }

        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    await completeStripeEvent(event.id);
    const { drainCommerceMail } = await import("../../lib/commerce-mail");
    await drainCommerceMail(1).catch(() => {});

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    await failStripeEvent(event.id, error).catch((loggingError) => {
      console.error("Stripe webhook failure state could not be saved:", loggingError);
    });
    return new Response("Webhook handler failed", { status: 500 });
  }
};
