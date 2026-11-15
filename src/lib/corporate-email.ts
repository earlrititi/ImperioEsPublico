import sanitizeHtml from "sanitize-html";
import { SITE } from "../config/site";
import { BRAND } from "../config/brand";

// Stable renderer identity: preserve detection of frozen retries and archived mail.
export const CORPORATE_EMAIL_LAYOUT = "pergamino-v1";
export const CORPORATE_EMAIL_ASSETS = `${BRAND.url}/brand/logos`;
const marker = `data-imperio-email-layout="${CORPORATE_EMAIL_LAYOUT}"`;
export const CORPORATE_EMAIL_BRAND = "official-20261114";
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
  /** Choose an authorized PNG; never recolor an image for a different background. */
  headerTheme?: "light" | "dark";
  /** Only this explicit state may have an empty subject and body; never sent. */
  empty?: boolean;
};

/** Shared EmailBrandLayout. Content, links and delivery remain owned by each flow. */
export function renderCorporateEmail(content: CorporateEmailContent) {
  const empty = content.empty === true;
  const bodyText = empty ? "" : content.bodyText ?? textOf(content.bodyHtml ?? "");
  const body = empty ? "" : sanitizeEmailBody(content.bodyHtml || `<p>${escapeEmailHtml(bodyText).replaceAll("\n", "<br>")}</p>`);
  const title = empty ? "" : escapeEmailHtml(content.visualTitle ?? "");
  const preheader = empty ? "" : escapeEmailHtml(content.preheader ?? "");
  const legal = empty ? "" : sanitizeEmailBody(content.legalHtml ?? "");
  if (!empty) validateCorporateMessage({ subject: content.subject, html: body, text: bodyText });
  const links = SITE.sameAs.map((url, index) => `<a href="${escapeEmailHtml(url)}" style="color:#713126;text-decoration:underline;margin:0 7px">${["Instagram", "Facebook", "X"][index] ?? "Red social"}</a>`).join(" ");
  const headerTheme = content.headerTheme ?? "light";
  const headerColor = headerTheme === "dark" ? "#141414" : "#ffffff";
  const logo = BRAND.email.logos[headerTheme];
  const logoWidth = 184;
  const logoHeight = Math.round(logoWidth * BRAND.email.height / BRAND.email.width);
  // Deployment rollback switch also covers callers using this renderer directly.
  if (!empty && (import.meta.env?.EMAIL_PARCHMENT_ENABLED ?? process.env.EMAIL_PARCHMENT_ENABLED) === "false") {
    return { html: `<!doctype html><html lang="es"><body ${marker} style="font:16px/1.6 Georgia,serif;color:#39281f;background:#f4ddbb"><main style="max-width:600px;margin:auto;padding:24px">${title ? `<h1>${title}</h1>` : ""}${body}${legal}</main></body></html>`, text: [bodyText, content.legalText ?? ""].filter(Boolean).join("\n\n") };
  }
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${empty ? "" : escapeEmailHtml(content.subject ?? "")}</title><style>
  body,table,td{margin:0;padding:0}table{border-collapse:collapse}img{border:0;display:block}a{color:#8c171d}p{margin:0 0 18px}h1,h2,h3{line-height:1.25;overflow-wrap:anywhere}h1{font-size:26px}h2{font-size:23px}pre,code{white-space:pre-wrap;word-break:break-word}td,th{overflow-wrap:anywhere;word-break:break-word}
  @media only screen and (max-width:600px){.imperio-container{width:100%!important}.imperio-message{padding:22px 8%!important;font-size:16px!important;line-height:1.65!important}.imperio-title{padding:24px 8% 0!important;font-size:25px!important}.imperio-legal{padding:20px 8%!important}.imperio-logo{width:168px!important;height:auto!important}}
  @media(prefers-color-scheme:dark){.imperio-header--light{background-color:#ffffff!important}.imperio-header--dark{background-color:#141414!important}.imperio-message,.imperio-title,.imperio-legal{background-color:#fffaf2!important;color:#39281f!important}.imperio-message a,.imperio-legal a{color:#8c171d!important}}
  </style><!--[if mso]><style>table{border-collapse:collapse}td{font-family:Georgia,'Times New Roman',serif}a{color:#8c171d}</style><![endif]--></head>
  <body ${marker} data-imperio-brand="${CORPORATE_EMAIL_BRAND}" style="margin:0;padding:0;background:#e8ddd0;color:#39281f;font-family:Georgia,'Times New Roman',serif"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8ddd0"><tr><td align="center" style="padding:10px 0"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table class="imperio-container" role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fffaf2">
  <tr><td class="imperio-header--${headerTheme}" align="center" bgcolor="${headerColor}" style="padding:24px;background-color:${headerColor}"><a href="${BRAND.url}/" style="display:inline-block"><img class="imperio-logo" src="${logo}" width="${logoWidth}" height="${logoHeight}" alt="${BRAND.name}" style="display:block;width:${logoWidth}px;max-width:100%;height:auto;border:0;color:${headerTheme === "dark" ? "#ffffff" : "#141414"};font:16px Arial,sans-serif"></a></td></tr>
  ${title ? `<tr><td class="imperio-title" align="left" bgcolor="#fffaf2" style="padding:28px 8% 0;font-size:28px;line-height:1.25;color:#39281f">${title}</td></tr>` : ""}
  <tr><td class="imperio-message" valign="top" bgcolor="#fffaf2" style="padding:${empty ? "28px 8% 84px" : "24px 8% 16px"};font-size:17px;line-height:1.65;color:#39281f;overflow-wrap:anywhere;word-break:break-word">${body}</td></tr>
  <tr><td class="imperio-legal" align="center" bgcolor="#fffaf2" style="padding:20px 8% 24px;border-top:1px solid #ded3c4;font:12px/1.6 Arial,sans-serif;color:#624f40">${legal}${empty ? "" : `<p style="margin:10px 0"><a href="${SITE.url}/" style="color:#8c171d">imperioes.com</a> · <a href="mailto:${SITE.contactEmail}" style="color:#8c171d">${SITE.contactEmail}</a></p><p style="margin:6px 0">${links}</p>`}</td></tr>
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
  return local ? { ...rendered, html: rendered.html.replaceAll(CORPORATE_EMAIL_ASSETS, `${url.origin}/brand/logos`) } : rendered;
}
