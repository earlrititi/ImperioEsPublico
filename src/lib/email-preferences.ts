import { LEGAL_DOCUMENT_VERSIONS } from "../config/legal";
import { EMAIL_MARKETING_CONSENT, EMAIL_MARKETING_COPY_VERSION } from "../config/email-marketing";
import { rpc } from "./reservations";

export type EmailPreference = { active: boolean; verified: boolean; blocked: boolean; updatedAt: string | null };
export async function getEmailPreference(userId: string): Promise<EmailPreference> {
  return rpc("get_account_email_preference", { p_user: userId });
}
export async function setEmailPreference(userId: string, accepted: boolean): Promise<EmailPreference> {
  return rpc("set_account_email_preference", { p_user: userId, p_accepted: accepted,
    p_version: LEGAL_DOCUMENT_VERSIONS.privacy, p_copy_version: EMAIL_MARKETING_COPY_VERSION, p_copy: EMAIL_MARKETING_CONSENT });
}
