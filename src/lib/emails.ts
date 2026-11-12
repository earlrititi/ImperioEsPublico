import { getRequiredEnv } from "./env";
import { resend } from "./resend";
import { renderCustomerMail, type CustomerMailParameters } from "./customer-mail-catalog";

export async function sendTshirtDiscountEmail(params: CustomerMailParameters<"tshirt_discount">[0]) {
  const siteUrl = getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
  return resend.emails.send(renderCustomerMail("tshirt_discount", params, siteUrl), {
    idempotencyKey: `arcabucero-discount-${params.reference}`,
  });
}

export async function sendPiqueroWelcomeEmail(params: CustomerMailParameters<"piquero_welcome">[0]) {
  return resend.emails.send(renderCustomerMail("piquero_welcome", params));
}

export async function sendPaidWelcomeEmail(params: CustomerMailParameters<"paid_welcome">[0]) {
  const siteUrl = getRequiredEnv("PUBLIC_SITE_URL").replace(/\/$/, "");
  return resend.emails.send(renderCustomerMail("paid_welcome", params, siteUrl));
}

export async function sendPaymentFailedEmail(params: CustomerMailParameters<"payment_failed">[0]) {
  return resend.emails.send(renderCustomerMail("payment_failed", params));
}

export async function sendSubscriptionCancelledEmail(params: CustomerMailParameters<"subscription_cancelled">[0]) {
  return resend.emails.send(renderCustomerMail("subscription_cancelled", params));
}

export async function sendMerchPurchaseEmail(params: CustomerMailParameters<"merch_purchase">[0]) {
  return resend.emails.send(renderCustomerMail("merch_purchase", params));
}
