import { randomUUID } from "node:crypto";
import type { APIContext } from "astro";
import { SITE } from "../config/site";
import { auditAdmin } from "./admin-data";
import {
  corporateMailboxPassword,
  mailboxQuery,
  readApplicationMailbox,
  readCorporateMailbox,
} from "./admin-mailbox";
import { COMMUNICATION_SOURCES, redactedText } from "./communications-model";
import { readArchivedApplicationMailbox } from "./customer-mail-archive";
import { database, failure, limited, optionalEnv, privateJson, requireAdmin } from "./reservations";

type Direction = "inbound" | "outbound";
type Source = "ionos" | "archive" | "resend";
type Reference =
  | { source: "ionos"; folder: string; validity: number; uid: number }
  | { source: "archive"; id: string; providerId?: string }
  | { source: "resend"; id: string };
type MessageReference = { v: 1; direction: Direction; refs: Reference[] };
export type UnifiedMailItem = {
  reference: Reference;
  direction: Direction;
  subject: string;
  from: string[];
  to: string[];
  date: string | null;
  receivedAt?: string | null;
  seen?: boolean;
  state?: string;
  provider?: string | null;
  providerId?: string | null;
  internetMessageId?: string | null;
};
export type UnifiedMailBatch = {
  source: Source;
  status: "connected" | "unavailable" | "not_configured";
  items: UnifiedMailItem[];
  warning?: string;
};
type Cursor = { v: 1; ceiling: string; filter: string; q: string; date: string; key: string };
export type UnifiedMailboxQuery = {
  filter: "all" | Direction;
  q: string;
  id: string;
  cursor: Cursor | null;
  refresh?: boolean;
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (value: string) => {
  if (!/^[A-Za-z0-9_-]{1,8000}$/.test(value)) throw Error("INVALID_INPUT");
  try { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")); }
  catch { throw Error("INVALID_INPUT"); }
};
const validDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const uint = (value: unknown) => Number.isInteger(value) && Number(value) > 0 && Number(value) <= 4294967295;
const archiveId = (id: unknown) => typeof id === "string" &&
  COMMUNICATION_SOURCES.some(source => id.startsWith(`${source}:`) && UUID.test(id.slice(source.length + 1)));
function messageReference(id: string): MessageReference {
  const value = decode(id);
  if (value?.v !== 1 || !["inbound", "outbound"].includes(value.direction) ||
    !Array.isArray(value.refs) || !value.refs.length || value.refs.length > 8) throw Error("INVALID_INPUT");
  for (const ref of value.refs) {
    if (ref?.source === "ionos" && typeof ref.folder === "string" && /^[A-Za-z0-9_-]{1,700}$/.test(ref.folder) && uint(ref.validity) && uint(ref.uid)) continue;
    if (ref?.source === "archive" && archiveId(ref.id) && (!ref.providerId || UUID.test(ref.providerId))) continue;
    if (ref?.source === "resend" && UUID.test(ref.id || "")) continue;
    throw Error("INVALID_INPUT");
  }
  return value;
}
export function unifiedMailboxQuery(params: URLSearchParams): UnifiedMailboxQuery {
  const filter = params.get("filter") || "all", q = (params.get("q") || "").trim(), id = params.get("id") || "";
  if (!["all", "inbound", "outbound"].includes(filter) || q.length > 100 || /[\u0000-\u001f\u007f]/.test(q)) throw Error("INVALID_INPUT");
  if (id) messageReference(id);
  const rawCursor = params.get("cursor"), cursor = rawCursor ? decode(rawCursor) : null;
  const refresh = params.has("refresh");
  if (refresh && (params.getAll("refresh").length !== 1 || params.get("refresh") !== "1" || id || rawCursor)) throw Error("INVALID_INPUT");
  if (rawCursor && (!cursor || cursor.v !== 1 || !validDate(cursor.ceiling) || typeof cursor.date !== "string" ||
    (cursor.date !== "" && !validDate(cursor.date)) || typeof cursor.key !== "string" || cursor.key.length > 2000 ||
    cursor.filter !== filter || cursor.q !== q)) throw Error("INVALID_INPUT");
  return { filter: filter as UnifiedMailboxQuery["filter"], q, id, cursor, refresh };
}

const priority: Record<Source, number> = { archive: 0, ionos: 1, resend: 2 };
const timestamp = (value: string | null) => value && validDate(value) ? new Date(value).toISOString() : "";
const exactKeys = (item: UnifiedMailItem) => [
  item.provider && item.providerId ? `${item.direction}:provider:${item.provider}:${item.providerId}` : "",
  item.internetMessageId ? `${item.direction}:message:${item.internetMessageId}` : "",
].filter(Boolean);

/** Only exact provider/message identifiers join copies; subjects and addresses never do. */
export function mergeUnifiedMessages(items: UnifiedMailItem[]) {
  const groups: UnifiedMailItem[][] = [], owners = new Map<string, UnifiedMailItem[]>();
  for (const item of items) {
    const keys = exactKeys(item), matched = [...new Set(keys.map(key => owners.get(key)).filter(Boolean))] as UnifiedMailItem[][];
    const group = matched[0] || [];
    if (!matched.length) groups.push(group);
    for (const other of matched.slice(1)) {
      group.push(...other);
      groups.splice(groups.indexOf(other), 1);
      for (const [key, owner] of owners) if (owner === other) owners.set(key, group);
    }
    group.push(item);
    for (const key of keys) owners.set(key, group);
  }
  return groups.map(group => {
    group.sort((a, b) => priority[a.reference.source] - priority[b.reference.source] || encode(a.reference).localeCompare(encode(b.reference)));
    const first = group[0], refs = [...new Map(group.map(item => [encode(item.reference), item.reference])).values()].slice(0, 8);
    const keys = group.flatMap(exactKeys).sort(), key = keys.find(value => value.includes(":provider:resend:")) || keys[0] || `${first.direction}:reference:${encode(first.reference)}`;
    return {
      id: encode({ v: 1, direction: first.direction, refs } satisfies MessageReference),
      subject: first.subject,
      from: first.from,
      to: first.to,
      date: timestamp(first.date) || null,
      direction: first.direction,
      seen: group.some(item => item.seen),
      state: first.state,
      source: first.reference.source,
      sources: [...new Set(group.map(item => item.reference.source))],
      key,
    };
  }).sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.key.localeCompare(b.key));
}

const metadataColumns = "id,source,direction,sender,email,recipient_email,subject,created_at,occurred_at,sent_at,state,flow,stage,provider,provider_id,internet_message_id";
const sentStatuses = ["sent", "SENT", "accepted", "succeeded", "delivered"];
type IndexCache = { expires: number; value: Promise<UnifiedMailBatch[]> };
let localIndex: IndexCache | undefined, retainedIndex: IndexCache | undefined;
async function archiveIndex(): Promise<UnifiedMailBatch> {
  const db = await database(), items: UnifiedMailItem[] = [];
  for (let page = 0; ; page++) {
    const result = await db.from("admin_communication_records").select(metadataColumns)
      .eq("direction", "outbound").in("source_status", sentStatuses)
      .order("occurred_at", { ascending: false }).order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (result.error) throw Error("MAIL_ARCHIVE_UNAVAILABLE");
    const rows = result.data || [];
    items.push(...rows.map((row: any): UnifiedMailItem => ({
      reference: { source: "archive", id: row.id, ...(row.provider === "resend" && UUID.test(row.provider_id || "") ? { providerId: row.provider_id } : {}) },
      direction: "outbound", subject: redactedText(row.subject || "Asunto no conservado", 500),
      from: row.sender ? [redactedText(row.sender, 320)] : [], to: row.recipient_email || row.email ? [redactedText(row.recipient_email || row.email, 320)] : [],
      date: row.sent_at || row.occurred_at || null, seen: true, state: row.state,
      receivedAt: row.created_at || null,
      provider: row.provider, providerId: row.provider_id, internetMessageId: row.internet_message_id,
    })));
    if (rows.length < 1000) break;
  }
  return { source: "archive", status: "connected", items };
}
async function ionosIndex(): Promise<UnifiedMailBatch> {
  const password = await corporateMailboxPassword();
  if (!password) return { source: "ionos", status: "not_configured", items: [] };
  const inbox = await readCorporateMailbox({ ...mailboxQuery(new URLSearchParams()), allMetadata: true }, password);
  const toItems = (result: typeof inbox, kind: string) => {
    return (result.items || []).map((row: any): UnifiedMailItem => ({
      ...row, reference: { source: "ionos", folder: result.folder, validity: result.validity, uid: Number(row.id) },
      direction: kind === "inbox" ? "inbound" : kind === "sent" || row.from.some((sender: string) =>
        (sender.match(/<([^<>]+)>/)?.[1] || sender).trim().toLowerCase() === SITE.contactEmail.toLowerCase()) ? "outbound" : "inbound",
    }));
  };
  const items = toItems(inbox, "inbox"), folders = inbox.folders.filter(folder => folder.kind !== "inbox" && folder.kind !== "drafts");
  let unavailable = false;
  // Include archived/other retained folders, while limiting simultaneous TLS sessions.
  for (let offset = 0; offset < folders.length; offset += 3) {
    const batches = await Promise.allSettled(folders.slice(offset, offset + 3).map(async folder =>
      toItems(await readCorporateMailbox({ ...mailboxQuery(new URLSearchParams({ folder: folder.id })), allMetadata: true }, password), folder.kind)));
    for (const batch of batches) {
      if (batch.status === "fulfilled") items.push(...batch.value);
      else unavailable = true;
    }
  }
  return {
    source: "ionos", status: "connected", items,
    ...(unavailable ? { warning: "No se ha podido consultar alguna carpeta de la cuenta. Vuelve a actualizar para completar los mensajes recibidos y enviados." } : {}),
  };
}
async function providerIndex(): Promise<UnifiedMailBatch> {
  if (!optionalEnv("RESEND_API_KEY")) return { source: "resend", status: "not_configured", items: [] };
  const items: UnifiedMailItem[] = [], seen = new Set<string>();
  let after = "";
  for (;;) {
    const result = await readApplicationMailbox({ ...mailboxQuery(new URLSearchParams({ folder: "application", after })), limit: 100 });
    items.push(...(result.items || []).map((row: any): UnifiedMailItem => ({
      ...row, reference: { source: "resend", id: row.id }, direction: "outbound", provider: "resend", providerId: row.id,
    })));
    if (!result.hasMore || !result.nextAfter) break;
    if (seen.has(result.nextAfter)) throw Error("MAILBOX_PROVIDER_UNAVAILABLE");
    seen.add(result.nextAfter);
    after = result.nextAfter;
    // Respect the provider's read rate; the complete retained index is cached.
    await new Promise<void>(resolve => { setTimeout(resolve, 550); });
  }
  return { source: "resend", status: "connected", items };
}
const safeBatch = async (source: Source, read: () => Promise<UnifiedMailBatch>): Promise<UnifiedMailBatch> => {
  try { return await read(); }
  catch { return { source, status: "unavailable", items: [] }; }
};
async function listSources() {
  const now = Date.now();
  if (!localIndex || localIndex.expires <= now) localIndex = { expires: now + 30_000, value: Promise.all([safeBatch("archive", archiveIndex), safeBatch("ionos", ionosIndex)]) };
  if (!retainedIndex || retainedIndex.expires <= now) retainedIndex = { expires: now + 120_000, value: safeBatch("resend", providerIndex).then(result => [result]) };
  return (await Promise.all([localIndex.value, retainedIndex.value])).flat();
}
/** Connection setup invalidates metadata only; credentials and message bodies are never cached. */
export function invalidateUnifiedMailboxIndex(includeProvider = false) {
  localIndex = undefined;
  if (includeProvider) retainedIndex = undefined;
}

async function readReference(ref: Reference): Promise<any> {
  if (ref.source === "archive") return readArchivedApplicationMailbox({ id: ref.id, q: "", page: 0 });
  if (ref.source === "resend") return readApplicationMailbox({ ...mailboxQuery(new URLSearchParams()), providerId: ref.id });
  const password = await corporateMailboxPassword();
  if (!password) throw Error("MAILBOX_CONNECTION_FAILED");
  return readCorporateMailbox({ ...mailboxQuery(new URLSearchParams()), folder: ref.folder, validity: ref.validity, uid: ref.uid }, password);
}
export type UnifiedMailboxDependencies = {
  listSources: () => Promise<UnifiedMailBatch[]>;
  readReference: (reference: Reference) => Promise<any>;
  now: () => Date;
};
const readerDependencies: UnifiedMailboxDependencies = { listSources, readReference, now: () => new Date() };
const coverage = "Mensajes recibidos y enviados de la cuenta y envíos registrados por la web, junto con el historial que conserva el proveedor. La búsqueda consulta asunto, remitente y destinatario. Los cuerpos antiguos pueden no conservarse; no se reconstruyen.";
export async function readUnifiedMailbox(query: UnifiedMailboxQuery, deps = readerDependencies) {
  const checkedAt = deps.now().toISOString();
  if (query.id) {
    const reference = messageReference(query.id), refs = [...reference.refs];
    for (const ref of reference.refs) if (ref.source === "archive" && ref.providerId && !refs.some(item => item.source === "resend" && item.id === ref.providerId)) refs.push({ source: "resend", id: ref.providerId });
    let fallback: any, lastError: unknown;
    for (const ref of refs) {
      try {
        const response = await deps.readReference(ref);
        if (!response.message) continue;
        const message = { ...response.message, id: query.id, direction: reference.direction };
        fallback ||= message;
        // Authentication archive omissions must never be replaced by provider bodies.
        if (message.bodyAvailable || /autenticación/i.test(message.omissionReason || "")) return { connected: true, source: "unified", address: SITE.contactEmail, message, checkedAt };
      } catch (error) { lastError = error; }
    }
    if (fallback) return { connected: true, source: "unified", address: SITE.contactEmail, message: fallback, checkedAt };
    throw lastError || Error("NOT_FOUND");
  }
  const batches = await deps.listSources(), ceiling = query.cursor?.ceiling || checkedAt;
  const search = query.q.toLocaleLowerCase("es");
  const merged = mergeUnifiedMessages(batches.flatMap(batch => batch.items).filter(item => !timestamp(item.receivedAt || item.date) || timestamp(item.receivedAt || item.date) <= ceiling));
  const matching = merged.filter(item => (query.filter === "all" || item.direction === query.filter) &&
    (!search || `${item.subject}\n${item.from.join(" ")}\n${item.to.join(" ")}`.toLocaleLowerCase("es").includes(search)));
  const remaining = query.cursor ? matching.filter(item => (item.date || "") < query.cursor!.date || ((item.date || "") === query.cursor!.date && item.key.localeCompare(query.cursor!.key) > 0)) : matching;
  const page = remaining.slice(0, 25), last = page.at(-1), hasMore = remaining.length > 25;
  const warnings = batches.flatMap(batch => batch.warning ? [batch.warning] : batch.status === "unavailable" ? [batch.source === "ionos" ? "No se ha podido consultar la cuenta de correo. Parte de los mensajes recibidos o enviados puede faltar temporalmente." : "Una parte del historial de envíos no está disponible temporalmente. Vuelve a actualizar."] : []);
  return {
    connected: batches.some(batch => batch.status === "connected"), source: "unified", address: SITE.contactEmail,
    items: page.map(({ key: _key, ...item }) => item), total: matching.length,
    hasMore, nextCursor: hasMore && last ? encode({ v: 1, ceiling, filter: query.filter, q: query.q, date: last.date || "", key: last.key } satisfies Cursor) : null,
    checkedAt, coverage, warnings: [...new Set(warnings)],
    needsConnection: batches.some(batch => batch.source === "ionos" && batch.status === "not_configured"),
  };
}

type HandlerDependencies = {
  guard: typeof requireAdmin;
  limit: typeof limited;
  audit: typeof auditAdmin;
  read: typeof readUnifiedMailbox;
};
const handlerDependencies: HandlerDependencies = { guard: requireAdmin, limit: limited, audit: auditAdmin, read: readUnifiedMailbox };
/** The guard precedes query parsing, credential lookup and every private source. */
export async function unifiedMailboxGet(context: APIContext, deps = handlerDependencies) {
  try {
    const actor = await deps.guard(context);
    await deps.limit(context.request, "admin_mailbox_read", 60);
    await deps.audit(actor.id, "communications", randomUUID(), "ADMIN_PRIVATE_READ");
    const query = unifiedMailboxQuery(context.url.searchParams);
    if (query.refresh) invalidateUnifiedMailboxIndex(true);
    return privateJson(await deps.read(query));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (["FORBIDDEN", "INVALID_INPUT", "ORIGIN_NOT_ALLOWED", "RATE_LIMITED"].includes(code)) return failure(error);
    return privateJson({ error: ["NOT_FOUND", "MAILBOX_RESET_REQUIRED"].includes(code) ? code : "MAILBOX_CONNECTION_FAILED" }, code === "NOT_FOUND" ? 404 : code === "MAILBOX_RESET_REQUIRED" ? 409 : 502);
  }
}
