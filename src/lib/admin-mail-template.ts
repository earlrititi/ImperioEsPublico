import { LEGAL_BUSINESS } from "../config/legal";
import { renderCorporateEmail } from "./corporate-email";
export type MailContent = { subject: string; preheader: string; content: string; cta_label: string; cta_url: string };
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export function validateMail(input: Record<string, unknown>): MailContent {
  const text = (key: string, max: number) => {
    const value = input[key];
    if (typeof value !== "string" || value.length > max) throw new Error("INVALID_INPUT");
    return value.trim();
  };
  const result = { subject: text("subject", 180), preheader: text("preheader", 250), content: text("content", 10000), cta_label: text("cta_label", 80), cta_url: text("cta_url", 500) };
  if (!result.subject || !result.content || /[\r\n]/.test(result.subject)) throw new Error("INVALID_INPUT");
  if (Boolean(result.cta_label) !== Boolean(result.cta_url)) throw new Error("INVALID_INPUT");
  if (result.cta_url) {
    if (!URL.canParse(result.cta_url)) throw new Error("INVALID_INPUT");
    const url = new URL(result.cta_url);
    if (url.protocol !== "https:" || !["imperioes.com", "www.imperioes.com"].includes(url.hostname) || url.username || url.password)
      throw new Error("INVALID_INPUT");
  }
  return result;
}
export function renderAdminMail(mail: MailContent, unsubscribe?: string, signature = false) {
  const identity = `${LEGAL_BUSINESS.ownerName} — ${LEGAL_BUSINESS.tradeName}. NIF ${LEGAL_BUSINESS.taxId}. ${LEGAL_BUSINESS.registeredAddress}`;
  const body = mail.content.split(/\n\s*\n/).map(p => `<p>${escape(p).replaceAll("\n", "<br>")}</p>`).join("");
  const signoff = signature ? '<p style="margin-top:28px">Un abrazo,<br><strong>Equipo de Imperio Espa&#241;ol</strong></p>' : "";
  return renderCorporateEmail({ subject: mail.subject, visualTitle: mail.subject, preheader: mail.preheader,
    bodyHtml: `${body}${mail.cta_url ? `<p><a href="${escape(mail.cta_url)}" style="display:inline-block;padding:14px 22px;border:1px solid #8c171d;color:#8c171d;text-decoration:none">${escape(mail.cta_label)}</a></p>` : ""}${signoff}`,
    bodyText: `${mail.content}${mail.cta_url ? `\n\n${mail.cta_label}: ${mail.cta_url}` : ""}${signature ? "\n\nUn abrazo,\nEquipo de Imperio Espa\u00f1ol" : ""}`,
    legalHtml: `<p>${escape(identity)}</p>${unsubscribe ? `<p><a href="${escape(unsubscribe)}">Dar de baja estas comunicaciones</a></p>` : ""}`,
    legalText: `${identity}${unsubscribe ? `\nBaja: ${unsubscribe}` : ""}`,
  });
}
