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
export function renderAdminMail(mail: MailContent, unsubscribe?: string) {
  const body = mail.content.split(/\n\s*\n/).map(p => `<p>${escape(p).replaceAll("\n", "<br>")}</p>`).join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#111114;color:#eeeeef;font:16px Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escape(mail.preheader)}</div><div style="max-width:620px;margin:auto;padding:36px 24px;border-top:3px solid #be333d"><p style="font:700 28px Georgia,serif">IMPERIO E</p>${body}${mail.cta_url ? `<p><a href="${escape(mail.cta_url)}" style="display:inline-block;padding:14px 22px;border:1px solid #d95560;border-radius:4px;color:#fff;text-decoration:none">${escape(mail.cta_label)}</a></p>` : ""}<hr style="border:0;border-top:1px solid #444"><p style="font-size:13px">contacto@imperioes.com${unsubscribe ? `<br><a style="color:#ddd" href="${escape(unsubscribe)}">Dar de baja estas comunicaciones</a>` : ""}</p></div></body></html>`;
  return { html, text: `${mail.content}${mail.cta_url ? `\n\n${mail.cta_label}: ${mail.cta_url}` : ""}\n\ncontacto@imperioes.com${unsubscribe ? `\nBaja: ${unsubscribe}` : ""}` };
}
