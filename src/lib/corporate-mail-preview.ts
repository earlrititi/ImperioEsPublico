import sanitizeHtml from "sanitize-html";
import { parseDocument, DomUtils } from "htmlparser2";
import { renderCorporateEmail } from "./corporate-email";
import {
  inertMessage,
  redactedText,
  safeMessageLink,
} from "./communications-model";
import { AUTH_REAUTHENTICATION_SUBJECT } from "./auth-mail-catalog";
import { BRAND } from "../config/brand";

const assetBase = "/images/email/pergamino-v1/";
const assetNames = [
  "cabecera-v2.png",
  "titulo.jpg",
  "extension-v2.png",
  "firma-nao-v2.jpg",
] as const;
// Legacy composite assets are allowed only to read immutable historical mail.
// New messages use the official PNGs from the centralized brand configuration.
const assetPaths = [
  ...assetNames.map((name) => `${assetBase}${name}`),
  ...Object.values(BRAND.email.logos).map((url) => new URL(url).pathname),
];
const canonicalAssets = new Map(
  assetPaths.flatMap((path) => [
    [`https://imperioes.com${path}`, path],
    [path, path],
  ]),
);
const classes = [
  "imperio-container",
  "imperio-message",
  "imperio-title",
  "imperio-legal",
  "imperio-image",
  "imperio-logo",
  "imperio-header--light",
  "imperio-header--dark",
];
const marker =
  /<body\b[^>]*\bdata-imperio-email-layout\s*=\s*["']pergamino-v1["'][^>]*>/i;
const trustedCss =
  renderCorporateEmail({ empty: true }).html.match(
    /<style>([\s\S]*?)<\/style>/i,
  )?.[1] ?? "";
const cspAssets = ["https://imperioes.com", "https://www.imperioes.com"]
  .flatMap((origin) => assetPaths.map((path) => `${origin}${path}`))
  .join(" ");
// Sanitization below admits only exact public brand paths. 'self' lets those
// relative paths load in the sandboxed reader on local and Vercel previews too.
const csp = `default-src 'none'; img-src 'self' ${cspAssets}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none'`;
const color = /^(?:#[a-f0-9]{3,8}|transparent|inherit|black|white)$/i;
const dimensions = /^(?:\d{1,3}(?:\.\d+)?(?:px|%)?|auto)$/;
const spacing =
  /^(?:\d{1,3}(?:\.\d+)?(?:px|%)?|auto)(?:\s+(?:\d{1,3}(?:\.\d+)?(?:px|%)?|auto)){0,3}$/;
const styles = {
  color: [color],
  "background-color": [color],
  background: [color],
  "background-image": [
    /^url\(['"]?\/images\/email\/pergamino-v1\/(?:cabecera-v2\.png|titulo\.jpg|extension-v2\.png|firma-nao-v2\.jpg)['"]?\)$/,
  ],
  "background-position": [/^(?:center(?: top)?|center center)$/],
  "background-repeat": [/^(?:no-repeat|repeat-y)$/],
  "background-size": [/^100% (?:100%|auto)$/],
  width: [dimensions],
  "max-width": [dimensions],
  height: [dimensions],
  "max-height": [dimensions],
  padding: [spacing],
  "padding-top": [spacing],
  "padding-bottom": [spacing],
  "padding-left": [spacing],
  "padding-right": [spacing],
  margin: [spacing],
  "margin-top": [spacing],
  "margin-bottom": [spacing],
  "margin-left": [spacing],
  "margin-right": [spacing],
  "font-family": [/^[a-zA-Z ,'"-]+$/],
  "font-size": [/^\d{1,2}px$/],
  "font-weight": [/^(?:[1-9]00|normal|bold)$/],
  "font-style": [/^(?:normal|italic)$/],
  font: [/^\d{1,2}px\/[\d.]+ [a-zA-Z ,'"-]+$/],
  "line-height": [/^(?:[1-3](?:\.\d+)?|\d{1,2}px)$/],
  "text-align": [/^(?:left|right|center|justify)$/],
  "text-decoration": [/^(?:none|underline)$/],
  "white-space": [/^(?:normal|nowrap|pre-wrap)$/],
  "word-break": [/^(?:normal|break-word)$/],
  "overflow-wrap": [/^(?:normal|anywhere|break-word)$/],
  display: [/^(?:none|block|inline|inline-block|table|table-cell)$/],
  overflow: [/^hidden$/],
  border: [/^(?:0|\d{1,2}px (?:solid|dashed|dotted) #[a-f0-9]{3,8})$/i],
  "border-collapse": [/^(?:collapse|separate)$/],
  "border-radius": [dimensions],
  "mso-hide": [/^all$/],
};

type PreviewHelpers = {
  redact(value: unknown, max?: number): string;
  publicLink(value: unknown): string | null;
};
type ParsedNode = ReturnType<typeof parseDocument>["children"][number];

function safeStyle(value: string) {
  return value
    .split(";")
    .flatMap((declaration) => {
      const colon = declaration.indexOf(":"),
        property = declaration.slice(0, colon).trim().toLowerCase();
      let content = declaration.slice(colon + 1).trim();
      if (
        colon < 1 ||
        !Object.hasOwn(styles, property) ||
        /[\\\u0000-\u001f]|\/\*|expression|@import/i.test(content)
      )
        return [];
      if (property === "background-image") {
        const match = content.match(/^url\(\s*(['"]?)(.*?)\1\s*\)$/i);
        const path = match && canonicalAssets.get(match[2]);
        if (!path) return [];
        content = `url('${path}')`;
      } else if (/url\s*\(/i.test(content)) return [];
      return [`${property}:${content}`];
    })
    .join(";");
}

// Decode entities and redact the whole visible sequence, so splitting a token
// across inline elements cannot hide it. Keep the original layout and images.
function redactVisibleText(html: string, helpers: PreviewHelpers) {
  const document = parseDocument(html),
    nodes: { data: string }[] = [];
  const visit = (node: ParsedNode) => {
    if (node.type === "text") nodes.push(node);
    if ("children" in node) for (const child of node.children) visit(child);
  };
  for (const node of document.children) visit(node);
  const original = nodes.map((node) => node.data).join(""),
    redacted = helpers.redact(original);
  if (original !== redacted) {
    let start = 0,
      suffix = 0;
    while (
      start < original.length &&
      start < redacted.length &&
      original[start] === redacted[start]
    )
      start++;
    while (
      suffix < original.length - start &&
      suffix < redacted.length - start &&
      original.at(-1 - suffix) === redacted.at(-1 - suffix)
    )
      suffix++;
    const end = original.length - suffix,
      replacement = redacted.slice(start, redacted.length - suffix);
    let offset = 0,
      inserted = false;
    for (const node of nodes) {
      const previous = node.data,
        nodeEnd = offset + previous.length;
      if (nodeEnd > start && offset < end) {
        node.data =
          previous.slice(0, Math.max(0, start - offset)) +
          (inserted ? "" : replacement) +
          previous.slice(Math.max(0, end - offset));
        inserted = true;
      }
      offset = nodeEnd;
    }
  }
  return {
    html: DomUtils.getOuterHTML(document),
    text: redacted,
    limited: original.length > 100_000,
  };
}

/** Preserve an existing corporate layout; never brand or rebuild external mail. */
export function corporateMailPreview(
  html: unknown,
  text: unknown,
  helpers: PreviewHelpers,
) {
  const original = String(html ?? "");
  const body = marker.exec(original);
  if (!body) return null;
  const source = original
    .slice(body.index + body[0].length)
    .replace(/<\/body\s*>[\s\S]*$/i, "")
    .slice(0, 200_000);
  const links = new Set<string>();
  const safe = sanitizeHtml(source, {
    allowedTags: [
      "p",
      "br",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "hr",
      "a",
      "img",
      "code",
      "pre",
    ],
    allowedAttributes: {
      "*": ["class", "style", "lang", "dir", "align", "valign"],
      table: ["width", "cellspacing", "cellpadding", "border", "role"],
      td: ["width", "height", "colspan", "rowspan", "background", "bgcolor"],
      th: ["scope", "colspan", "rowspan"],
      img: ["src", "alt", "width", "height"],
    },
    allowedClasses: { "*": classes },
    allowedStyles: { "*": styles },
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "noscript",
      "iframe",
      "object",
      "form",
    ],
    transformTags: {
      "*": (tagName, attributes) => {
        const attrs = { ...attributes };
        if (attrs.style) attrs.style = safeStyle(attrs.style);
        if (attrs.background) {
          const path = canonicalAssets.get(attrs.background);
          if (path) attrs.background = path;
          else delete attrs.background;
        }
        if (attrs.bgcolor && !color.test(attrs.bgcolor)) delete attrs.bgcolor;
        if (tagName === "img") {
          const path = canonicalAssets.get(attrs.src);
          if (path) attrs.src = path;
          else delete attrs.src;
        }
        if (tagName === "a") {
          const link = helpers.publicLink(attrs.href);
          if (link) links.add(link);
          return { tagName: "span", attribs: attrs };
        }
        return { tagName, attribs: attrs };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
  const redacted = redactVisibleText(safe, helpers);
  return {
    corporate: true as const,
    contentLimited:
      source.length >= 200_000 ||
      String(text ?? "").length > 100_000 ||
      redacted.limited,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${trustedCss}\nhtml{color-scheme:light}body{margin:0;padding:0;background:#e8ddd0;color:#39281f;font-family:Georgia,'Times New Roman',serif}table{max-width:100%;box-sizing:border-box}.imperio-container{width:100%!important;max-width:600px!important;margin:auto}.imperio-image{max-width:100%;height:auto!important}</style></head><body data-imperio-email-layout="pergamino-v1">${redacted.html}</body></html>`,
    text: helpers.redact(text || redacted.text),
    links: [...links].slice(0, 30),
  };
}

export type SafeMailPreview = ReturnType<typeof inertMessage> & {
  corporate?: true;
};

/** Only the existing marker selects a faithful preview; legacy mail stays inert. */
export function messagePreview(
  html: unknown,
  text?: unknown,
  subject?: unknown,
): SafeMailPreview {
  const normalizedSubject = String(subject ?? "")
    .trim()
    .replace(/^\[TEST - SIN COBRO REAL\] (?:\[run:[a-f0-9-]{36}\] )?/, "")
    .toLowerCase();
  if (normalizedSubject === AUTH_REAUTHENTICATION_SUBJECT.toLowerCase())
    return inertMessage(
      "",
      "Código de acceso omitido en la copia de consulta. Solo está disponible en el correo original del destinatario.",
    );
  return (
    corporateMailPreview(html, text, {
      redact: redactedText,
      publicLink: safeMessageLink,
    }) ?? inertMessage(html, text)
  );
}
