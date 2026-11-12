import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
} from "resend";
import { prepareCorporateEmail } from "./corporate-email";

export type CorporateMailClient = { emails: Pick<Resend["emails"], "send"> };
export type CorporateMailMessage = CreateEmailOptions;
export type CorporateMailOptions = CreateEmailRequestOptions;
export type CorporateMailResponse = CreateEmailResponse;
export type CorporateMailContext = { preserveSnapshot?: boolean };

// Keep the original method bound to the SDK instance. The compatibility
// singleton decorates emails.send, and must not recursively call its wrapper.
const providerSenders = new WeakMap<
  CorporateMailClient,
  Resend["emails"]["send"]
>();

export function createCorporateMailClient(apiKey: string): Resend {
  const client = new Resend(apiKey);
  providerSenders.set(client, client.emails.send.bind(client.emails));
  return client;
}

/** Validate every send; an existing retry snapshot is never rendered again. */
export function sendCorporateMail(
  client: CorporateMailClient,
  message: CorporateMailMessage,
  options?: CorporateMailOptions,
  context: CorporateMailContext = {},
): Promise<CorporateMailResponse> {
  const payload = prepareCorporateEmail(
    message,
    context.preserveSnapshot === true,
  );
  const send =
    providerSenders.get(client) ?? client.emails.send.bind(client.emails);
  return send(payload, options);
}
