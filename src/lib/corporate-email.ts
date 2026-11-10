import sanitizeHtml from "sanitize-html";
import { SITE } from "../config/site";

export const CORPORATE_EMAIL_LAYOUT = "pergamino-v1";
export const CORPORATE_EMAIL_ASSETS = `${SITE.url}/images/email/${CORPORATE_EMAIL_LAYOUT}`;
const marker = `data-imperio-email-layout="${CORPORATE_EMAIL_LAYOUT}"`;
export const escapeEmailHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const textOf = (html: string) => sanitizeHtml(html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n"), { allowedTags: [], allowedAttributes: {} }).trim();
const safeStyle = /^[a-zA-Z0-9#(),.%\s'"+\-/]+$/;

/** Existing flows own their wording and signed links; this layer only owns presentation. */
export function sanitizeEmailBody(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr", "a", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "img", "code", "pre"],
    allowedAttributes: { "*": ["style", "lang", "dir", "align", "valign"], a: ["href", "title"], img: ["src", "alt", "width", "height"], table: ["width", "cellspacing", "cellpadding", "border", "role"], td: ["width", "height", "colspan", "rowspan"], th: ["scope", "colspan", "rowspan"] },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "cid"] },
    allowProtocolRelative: false,
    allowedStyles: { "*": Object.fromEntries(["color", "background-color", "font-family", "font-size", "font-weight", "font-style", "line-height", "text-align", "text-decoration", "white-space", "word-break", "overflow-wrap", "display", "width", "max-width", "height", "border", "border-top", "border-bottom", "border-left", "border-right", "border-collapse", "border-radius", "padding", "padding-top", "padding-bottom", "padding-left", "padding-right", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right"].map(key => [key, [safeStyle]])) },
    transformTags: {
      a: (_tag, attrs) => ({ tagName: "a", attribs: { ...attrs, style: `color:#8c171d;overflow-wrap:anywhere;word-break:break-word;${attrs.style ?? ""}` } }),
      img: (_tag, attrs) => ({ tagName: "img", attribs: { ...attrs, alt: attrs.alt ?? "", style: `max-width:100%;height:auto;border:0;${attrs.style ?? ""}` } }),
      table: (_tag, attrs) => ({ tagName: "table", attribs: { ...attrs, style: `max-width:100%;table-layout:fixed;${attrs.style ?? ""}` } }),
    },
  });
}

export type CorporateEmailContent = {
  subject?: string;
  visualTitle?: string;
  preheader?: string;
  bodyHtml?: string;
  bodyText?: string;
  legalHtml?: string;
  legalText?: string;
  /** Only this explicit state may have an empty subject and body; never sent. */
  empty?: boolean;
};

/** A single responsive, extensible layout; the approved seal/signature are never stretched. */
export function renderCorporateEmail(content: CorporateEmailContent) {
  const empty = content.empty === true;
  const bodyText = empty ? "" : content.bodyText ?? textOf(content.bodyHtml ?? "");
  const body = empty ? "" : sanitizeEmailBody(content.bodyHtml || `<p>${escapeEmailHtml(bodyText).replaceAll("\n", "<br>")}</p>`);
  const title = empty ? "" : escapeEmailHtml(content.visualTitle ?? "");
  const preheader = empty ? "" : escapeEmailHtml(content.preheader ?? "");
  const legal = empty ? "" : sanitizeEmailBody(content.legalHtml ?? "");
  if (!empty) validateCorporateMessage({ subject: content.subject, html: body, text: bodyText });
  const links = SITE.sameAs.map((url, index) => `<a href="${escapeEmailHtml(url)}" style="color:#713126;text-decoration:underline;margin:0 7px">${["Instagram", "Facebook", "X"][index] ?? "Red social"}</a>`).join(" ");
  const asset = (name: string) => `${CORPORATE_EMAIL_ASSETS}/${name}`;
  // Deployment rollback switch also covers callers using this renderer directly.
  if (!empty && (import.meta.env?.EMAIL_PARCHMENT_ENABLED ?? process.env.EMAIL_PARCHMENT_ENABLED) === "false") {
    return { html: `<!doctype html><html lang="es"><body ${marker} style="font:16px/1.6 Georgia,serif;color:#39281f;background:#f4ddbb"><main style="max-width:600px;margin:auto;padding:24px">${title ? `<h1>${title}</h1>` : ""}${body}${legal}</main></body></html>`, text: [bodyText, content.legalText ?? ""].filter(Boolean).join("\n\n") };
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${empty ? "" : escapeEmailHtml(content.subject ?? "")}</title><style>
  body,table,td{margin:0;padding:0}table{border-collapse:collapse}img{border:0;display:block}a{color:#8c171d}p{margin:0 0 18px}h1,h2,h3{line-height:1.25;overflow-wrap:anywhere}h1{font-size:26px}h2{font-size:23px}pre,code{white-space:pre-wrap;word-break:break-word}td,th{overflow-wrap:anywhere;word-break:break-word}
  @media only screen and (max-width:600px){.imperio-container{width:100%!important}.imperio-message{padding:22px 9%!important;font-size:16px!important;line-height:1.65!important}.imperio-title{font-size:25px!important}.imperio-legal{padding:16px 9%!important}.imperio-image{width:100%!important;height:auto!important}}
  @media(prefers-color-scheme:dark){.imperio-message,.imperio-title,.imperio-legal{background-color:#f4ddbb!important;color:#39281f!important}.imperio-message a,.imperio-legal a{color:#8c171d!important}}
  </style><!--[if mso]><style>table{border-collapse:collapse}td{font-family:Georgia,'Times New Roman',serif}a{color:#8c171d}</style><![endif]--></head>
  <body ${marker} style="margin:0;padding:0;background:#e8ddd0;color:#39281f;font-family:Georgia,'Times New Roman',serif"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8ddd0"><tr><td align="center" style="padding:10px 0"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table class="imperio-container" role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#f4ddbb">
  <tr><td><img class="imperio-image" src="${asset("cabecera-v2.png")}" width="600" height="279" alt="Imperio Español" style="display:block;width:100%;height:auto"></td></tr>
  ${title || empty ? `<tr><td class="imperio-title" align="center" valign="middle" background="${asset("titulo.jpg")}" bgcolor="#f4ddbb" style="background-image:url('${asset("titulo.jpg")}');background-position:center;background-size:100% 100%;background-repeat:no-repeat;padding:6px 9%;height:78px;font-size:30px;line-height:1.2;color:#39281f">${title}</td></tr>` : ""}
  <tr><td class="imperio-message" valign="top" background="${asset("extension-v2.png")}" bgcolor="#f4ddbb" style="background-image:url('${asset("extension-v2.png")}');background-position:center top;background-repeat:repeat-y;background-size:100% auto;padding:${empty ? "28px 10% 84px" : "28px 10% 20px"};font-size:17px;line-height:1.65;color:#39281f;overflow-wrap:anywhere;word-break:break-word">${body}</td></tr>
  <tr><td><a href="${SITE.url}/" style="display:block"><img class="imperio-image" src="${asset("firma-nao-v2.jpg")}" width="600" height="375" alt="Imperio Español · imperioes.com" style="display:block;width:100%;height:auto"></a></td></tr>
  <tr><td class="imperio-legal" align="center" bgcolor="#f4ddbb" style="padding:14px 9% 20px;font:12px/1.6 Arial,sans-serif;color:#624f40">${legal}${empty ? "" : `<p style="margin:10px 0"><a href="${SITE.url}/" style="color:#8c171d">imperioes.com</a> · <a href="mailto:${SITE.contactEmail}" style="color:#8c171d">${SITE.contactEmail}</a></p><p style="margin:6px 0">${links}</p>`}</td></tr>
  </table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return { html, text: empty ? "" : [bodyText, content.legalText ?? "", `Imperio Español\n${SITE.url}/\n${SITE.contactEmail}`].filter(Boolean).join("\n\n") };
}

type EmailMessage = { subject?: string; html?: string | null; text?: string | null };

/** Fail before reaching the provider, including on immutable retry snapshots. */
export function validateCorporateMessage(message: EmailMessage) {
  if (!message.subject?.trim() || /[\r\n]/.test(message.subject)) throw Error("EMAIL_SUBJECT_INVALID");
  const semanticBody = message.html ? textOf(message.html.replace(/<head[\s\S]*?<\/head>/gi, "")) : message.text?.trim();
  if (!semanticBody || !message.text?.trim()) throw Error("EMAIL_BODY_REQUIRED");
  for (const value of [message.subject, message.html ?? "", message.text ?? ""]) {
    if (/\{\{[^{}]+\}\}|<%[\s\S]*?%>|\$\{[^{}]+\}/.test(value)) throw Error("EMAIL_UNRESOLVED_VARIABLE");
  }
  if (/^(?:\(?asunto\)?|\(?cuerpo\)?|lorem ipsum)$/i.test(semanticBody.trim()) || /\(Asunto\)/i.test(message.html ?? "")) throw Error("EMAIL_PLACEHOLDER_CONTENT");
  if (/<[^>]+\b(?:href|src|background)\s*=\s*["']\s*(?:data:|file:|javascript:|https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])|(?:\.\.\/|\.\/)|[a-z]:\\)/i.test(message.html ?? "")) throw Error("EMAIL_ASSET_URL_INVALID");
  if (/<(?:script|iframe|form|object|embed)\b|<[^>]+\bon[a-z]+\s*=/i.test(message.html ?? "")) throw Error("EMAIL_UNSAFE_HTML");
}

/** Apply at every transport boundary. Already rendered messages retain their snapshot. */
export function prepareCorporateEmail<T extends EmailMessage>(message: T): T & { html: string; text: string };
export function prepareCorporateEmail<T extends EmailMessage>(message: T, preserveSnapshot: boolean): T;
export function prepareCorporateEmail<T extends EmailMessage>(message: T, preserveSnapshot = false): T & { html?: string | null; text?: string | null } {
  if (preserveSnapshot) {
    validateCorporateMessage(message);
    return message;
  }
  if (message.html?.includes(marker)) {
    validateCorporateMessage(message);
    return message as T & { html: string; text: string };
  }
  const bodyText = message.text?.trim() || textOf(message.html ?? "");
  // Check the real content before adding decorative/brand text to an empty message.
  validateCorporateMessage({ ...message, text: bodyText });
  const enabled = (import.meta.env?.EMAIL_PARCHMENT_ENABLED ?? process.env.EMAIL_PARCHMENT_ENABLED) !== "false";
  const rendered = enabled ? renderCorporateEmail({ subject: message.subject, bodyHtml: message.html ?? undefined, bodyText }) : { html: message.html || `<p>${escapeEmailHtml(bodyText).replaceAll("\n", "<br>")}</p>`, text: bodyText };
  const payload = { ...message, ...rendered };
  validateCorporateMessage(payload);
  return payload;
}

/** Preview-only local asset mapping; transport HTML always keeps the canonical HTTPS URLs. */
export function corporateEmailPreview<T extends { html: string }>(rendered: T, origin: string): T {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return local ? { ...rendered, html: rendered.html.replaceAll(CORPORATE_EMAIL_ASSETS, `${url.origin}/images/email/${CORPORATE_EMAIL_LAYOUT}`) } : rendered;
}
