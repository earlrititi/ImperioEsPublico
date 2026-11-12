import sanitizeHtml from "sanitize-html";

import { COMMUNICATION_STATES, COMMUNICATION_SOURCES, AUDIENCE_STATES } from "./communications-labels";
export { COMMUNICATION_STATES, COMMUNICATION_SOURCES, AUDIENCE_STATES } from "./communications-labels";
export type CommunicationState = typeof COMMUNICATION_STATES[number];

// A provider acceptance, opening or click is never promoted to confirmed delivery.
export function communicationState(status: unknown, delivery: unknown, due?: string | null, now = Date.now()): CommunicationState {
  const event = String(delivery ?? "").toLowerCase().replace(/^email\./, "");
  if (["delivered", "deferred", "bounced", "complained", "failed", "unsubscribed"].includes(event)) return event as CommunicationState;
  if (["canceled", "cancelled"].includes(event)) return "cancelled";
  const raw = String(status ?? "").toLowerCase();
  if (raw === "received") return "received";
  if (["sent", "accepted", "succeeded"].includes(raw)) return "accepted_by_provider";
  if (raw === "suppressed") return "unsubscribed";
  if (["cancelled", "canceled"].includes(raw)) return "cancelled";
  if (raw === "failed") return "failed";
  if (["review", "needs_review"].includes(raw)) return "review";
  if (raw === "processing") return "processing";
  if (raw === "pending") return due && Date.parse(due) > now ? "scheduled" : "queued";
  return "recorded";
}

export function redactedText(value: unknown, max = 100_000): string {
  return String(value ?? "").slice(0, max)
    .replace(/https?:\/\/[^\s<>"']+/gi, "[enlace omitido en la copia de consulta]")
    .replace(/\b(?:Bearer\s+\S+|(?:sk|rk|re)_(?:live|test)_\S+|eyJ[A-Za-z0-9._-]{20,})/g, "[secreto omitido]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[identificador sensible omitido]")
    .replace(/((?:token|password|contraseña|secret|verification_code|codigo de verificaci[oó]n)\s*[:=]\s*)\S+/gi, "$1[omitido]");
}

export function safeMessageLink(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || url.username || url.password || /auth|login|verif|reset|password|gestionar|\/baja|preferencias/i.test(url.pathname) || url.pathname.split("/").some(part=>part.length>=24)) return null;
    url.search = ""; url.hash = "";
    return url.toString();
  } catch { return null; }
}

function decodedMessageText(html: string) {
  let text = "";
  // The sanitizer decodes entities before assembling a frame's text, including
  // descendants. This lets redaction see credentials split across inline tags.
  const separated = html.replace(/<br\s*\/?\s*>|<\/(?:p|div|h[1-6]|li|blockquote|tr|table)\s*>/gi, "\n$&");
  sanitizeHtml(`<div>${separated}</div>`, {
    allowedTags: ["div"], allowedAttributes: {},
    exclusiveFilter: frame => { if (frame.tagPosition === 0) text = frame.text; return false; },
  });
  return text;
}
const escapeMessageText = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// Preview intentionally omits every remote resource, style and active link.
export function inertMessage(html: unknown, text?: unknown) {
  const source = String(html ?? "").slice(0, 200_000);
  const links = new Set<string>();
  let safe = sanitizeHtml(source, {
    allowedTags: ["p", "br", "div", "span", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "td", "th", "hr", "a"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "form"],
    transformTags: { a: (_tag, attributes) => {
      const link = safeMessageLink(attributes.href); if (link) links.add(link);
      return { tagName: "span", attribs: {} };
    } },
  });
  if (!source.trim() && text) safe = `<div style="white-space:pre-wrap">${escapeMessageText(redactedText(text))}</div>`;
  const decodedText = decodedMessageText(safe);
  const redacted = redactedText(decodedText);
  // When credentials are present, use a semantic text rendering. Redacting
  // individual escaped text nodes can leak entity-encoded or fragmented tokens.
  if (redacted !== decodedText) safe = `<div style="white-space:pre-wrap">${escapeMessageText(redacted)}</div>`;
  const csp = "default-src 'none'; img-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'; connect-src 'none'";
  return {
    contentLimited: String(html ?? "").length > 200_000 || String(text ?? "").length > 100_000,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>body{font:16px/1.6 Georgia,serif;color:#28231e;background:#f6efd9;margin:0;padding:24px;overflow-wrap:anywhere}table{max-width:100%;border-collapse:collapse}td,th{padding:8px}a,span{color:inherit}</style></head><body>${safe}</body></html>`,
    text: redactedText(text || decodedText),
    links: [...links].slice(0, 30),
  };
}

export function dashboardQuery(params: URLSearchParams, audience = false) {
  const bounded = (name: string, max = 100) => {
    const value = params.get(name)?.trim() ?? "";
    if (value.length > max || /[\u0000-\u001f(),%*\\]/.test(value)) throw Error("INVALID_INPUT");
    return value;
  };
  const page = Number(params.get("page") ?? 0), pageSize = Number(params.get("pageSize") ?? 25);
  if (!Number.isInteger(page) || page < 0 || page > 10_000 || ![10, 25, 50].includes(pageSize)) throw Error("INVALID_INPUT");
  const state = bounded("state", 40), source = bounded("source", 50), type = bounded("type", 30);
  if (state && !(audience ? AUDIENCE_STATES : COMMUNICATION_STATES).includes(state as never)) throw Error("INVALID_INPUT");
  if (!audience && source && !COMMUNICATION_SOURCES.includes(source as never)) throw Error("INVALID_INPUT");
  if (type && !["transaccional", "marketing", "soporte", "contacto"].includes(type)) throw Error("INVALID_INPUT");
  const date = (name: string) => { const value = bounded(name, 10); if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)))) throw Error("INVALID_INPUT"); return value; };
  const direction = bounded("direction", 10);
  if (direction && !["outbound", "inbound"].includes(direction)) throw Error("INVALID_INPUT");
  return { page, pageSize, q: bounded("q"), state, source, type, direction, replies: params.get("replies") === "1", from: date("from"), to: date("to"), sender: bounded("sender"), provider: bounded("provider", 40), flow: bounded("flow", 80), order: bounded("order", 80), stage: bounded("stage", 80), sort: params.get("sort") === "oldest" ? "oldest" : "newest" };
}

export function csvCell(value: unknown) {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^[=+@\-\t\r ]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
