import { ImapFlow } from "imapflow";
import { SITE } from "../config/site";
import { AUTH_REAUTHENTICATION_SUBJECT } from "./auth-mail-catalog";
import { inertMessage, redactedText } from "./communications-model";
import { messagePreview } from "./corporate-mail-preview";
import { createCorporateMailClient } from "./customer-mail-service";
import { optionalEnv, rpc } from "./reservations";

const MAX_SOURCE = 2 * 1024 * 1024;
type Client = Pick<
  ImapFlow,
  | "connect"
  | "list"
  | "mailboxOpen"
  | "search"
  | "fetch"
  | "fetchOne"
  | "download"
  | "logout"
  | "close"
  | "on"
>;
export type MailboxQuery = {
  folder: string;
  q: string;
  before: number;
  validity: number;
  uid: number;
  providerId: string;
  after: string;
};
export function mailboxQuery(params: URLSearchParams): MailboxQuery {
  const integer = (name: string) => {
    const raw = params.get(name) || "0";
    if (!/^\d{1,10}$/.test(raw) || Number(raw) > 4294967295)
      throw Error("INVALID_INPUT");
    return Number(raw);
  };
  const folder = params.get("folder") || "inbox",
    q = (params.get("q") || "").trim(),
    providerId = params.get("id") || "",
    after = params.get("after") || "";
  if (
    !/^[A-Za-z0-9_-]{1,700}$/.test(folder) ||
    q.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(q) ||
    (providerId && !/^[a-f0-9-]{36}$/i.test(providerId)) ||
    (after && !/^[a-f0-9-]{36}$/i.test(after))
  )
    throw Error("INVALID_INPUT");
  return {
    folder,
    q,
    before: integer("before"),
    validity: integer("validity"),
    uid: integer("uid"),
    providerId,
    after,
  };
}
const text = (value: unknown, max = 500) =>
  redactedText(String(value ?? ""), max);
const isAuthenticationCode = (subject: unknown) =>
  String(subject ?? "")
    .trim()
    .replace(/^\[TEST - SIN COBRO REAL\] (?:\[run:[a-f0-9-]{36}\] )?/, "")
    .toLowerCase() === AUTH_REAUTHENTICATION_SUBJECT.toLowerCase();
const codeOmitted =
  "Código de acceso omitido en la copia de consulta. Solo está disponible en el correo original del destinatario.";
const address = (values: any): string[] =>
  Array.isArray(values)
    ? values
        .flatMap((item) =>
          item?.group
            ? address(item.group)
            : [String(item?.address || item?.name || "")],
        )
        .filter(Boolean)
        .slice(0, 50)
    : [];
const timestamp = (value: Date | string | undefined) => {
  if (!value) return null;
  const date = new Date(value instanceof Date ? value.getTime() : value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
const folderId = (path: string) =>
  Buffer.from(path, "utf8").toString("base64url");
export const corporateImapOptions = (password: string) => ({
  host: "imap.ionos.es",
  port: 993,
  secure: true,
  auth: { user: SITE.contactEmail, pass: password },
  logger: false as const,
  disableAutoIdle: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" as const },
});
function mimeParts(root: any) {
  const result: any[] = [],
    stack = [root];
  while (stack.length && result.length < 200) {
    const node = stack.shift();
    if (!node) continue;
    result.push(node);
    if (
      node.disposition !== "attachment" &&
      node.type !== "message/rfc822" &&
      Array.isArray(node.childNodes)
    )
      stack.push(...node.childNodes.slice(0, 200));
  }
  return result;
}
function mainTextPart(root: any) {
  let visited = 0;
  const visit = (node: any, depth = 0): any => {
    if (
      !node ||
      ++visited > 200 ||
      depth > 30 ||
      node.disposition === "attachment" ||
      node.dispositionParameters?.filename ||
      node.parameters?.name ||
      node.type === "message/rfc822"
    )
      return undefined;
    if (node.type === "text/html" || node.type === "text/plain") return node;
    const choices = (node.childNodes || [])
      .slice(0, 200)
      .map((child: any) => visit(child, depth + 1))
      .filter(Boolean);
    return node.type === "multipart/alternative"
      ? choices.findLast((part: any) => part.type === "text/html") ||
          choices.at(-1)
      : choices[0];
  };
  return visit(root);
}

/** No APPEND, STORE, DELETE or flag mutation is exposed by this adapter. */
export async function readCorporateMailbox(
  query: MailboxQuery,
  password: string,
  factory: (options: ReturnType<typeof corporateImapOptions>) => Client = (
    options,
  ) => new ImapFlow(options),
) {
  const client = factory(corporateImapOptions(password));
  client.on("error", () => undefined);
  try {
    await client.connect();
    const listed = (await client.list()).filter(
      (box) => !box.flags.has("\\Noselect"),
    );
    const folders = listed
      .slice(0, 200)
      .map((box) => ({
        id: folderId(box.path),
        name: text(box.name, 100),
        kind:
          box.path.toUpperCase() === "INBOX"
            ? "inbox"
            : box.specialUse === "\\Sent"
              ? "sent"
              : "folder",
      }));
    const selected = listed.find((box) =>
      query.folder === "inbox"
        ? box.path.toUpperCase() === "INBOX"
        : query.folder === "sent"
          ? box.specialUse === "\\Sent"
          : folderId(box.path) === query.folder,
    );
    if (!selected) throw Error("MAILBOX_FOLDER_NOT_FOUND");
    const box = await client.mailboxOpen(selected.path, { readOnly: true });
    if (!box.readOnly) throw Error("MAILBOX_READ_ONLY_REQUIRED");
    const validity = Number(box.uidValidity);
    if (query.validity && query.validity !== validity)
      throw Error("MAILBOX_RESET_REQUIRED");
    if (query.uid) {
      const item = await client.fetchOne(
        String(query.uid),
        {
          uid: true,
          envelope: true,
          size: true,
          flags: true,
          bodyStructure: true,
        },
        { uid: true },
      );
      if (!item) throw Error("NOT_FOUND");
      const parts = mimeParts(item.bodyStructure),
        body = mainTextPart(item.bodyStructure);
      let html = "",
        plain = "";
      if (body && !isAuthenticationCode(item.envelope?.subject)) {
        const download = await client.download(
          String(query.uid),
          body.part || "1",
          { uid: true, maxBytes: MAX_SOURCE, decodeText: true },
        );
        if (download.content) {
          const chunks: Buffer[] = [];
          let length = 0;
          for await (const chunk of download.content) {
            const buffer = Buffer.from(chunk);
            length += buffer.length;
            if (length > MAX_SOURCE) {
              download.content.destroy();
              break;
            }
            chunks.push(buffer);
          }
          const content = Buffer.concat(chunks).toString("utf8");
          if (body.type === "text/html") html = content;
          else plain = content;
        }
      }
      const preview = isAuthenticationCode(item.envelope?.subject)
        ? inertMessage("", codeOmitted)
        : messagePreview(html, plain, item.envelope?.subject);
      return {
        connected: true,
        source: "ionos",
        folders,
        folder: folderId(selected.path),
        validity,
        message: {
          id: String(item.uid),
          subject: text(item.envelope?.subject || "Sin asunto"),
          from: address(item.envelope?.from),
          to: address(item.envelope?.to),
          date: timestamp(item.envelope?.date),
          ...preview,
          attachments: parts
            .filter(
              (part) =>
                part.disposition === "attachment" ||
                part.dispositionParameters?.filename ||
                part.parameters?.name,
            )
            .map((part) => ({
              name: text(
                part.dispositionParameters?.filename ||
                  part.parameters?.name ||
                  "Adjunto",
                180,
              ),
              size: part.size || 0,
            })),
          bodyAvailable: Boolean(body),
          contentLimited:
            preview.contentLimited || (body?.size || 0) > MAX_SOURCE,
        },
        checkedAt: new Date().toISOString(),
      };
    }
    const search: any = query.q
      ? {
          or: [
            { from: query.q },
            { to: query.q },
            { subject: query.q },
            { body: query.q },
          ],
        }
      : { all: true };
    if (query.before === 1)
      return {
        connected: true,
        source: "ionos",
        folders,
        folder: folderId(selected.path),
        validity,
        items: [],
        hasMore: false,
        nextBefore: null,
        total: box.exists,
        checkedAt: new Date().toISOString(),
      };
    if (query.before) search.uid = `1:${query.before - 1}`;
    const matches = await client.search(search, { uid: true });
    const uids = (Array.isArray(matches) ? matches : []).sort((a, b) => b - a),
      page = uids.slice(0, 25),
      items: any[] = [];
    if (page.length)
      for await (const item of client.fetch(
        page.join(","),
        {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          size: true,
        },
        { uid: true },
      )) {
        items.push({
          id: String(item.uid),
          subject: text(item.envelope?.subject || "Sin asunto"),
          from: address(item.envelope?.from),
          to: address(item.envelope?.to),
          date: timestamp(item.envelope?.date || item.internalDate),
          seen: item.flags?.has("\\Seen") ?? false,
          size: item.size ?? 0,
        });
      }
    items.sort((a, b) => Number(b.id) - Number(a.id));
    return {
      connected: true,
      source: "ionos",
      folders,
      folder: folderId(selected.path),
      validity,
      items,
      total: box.exists,
      hasMore: uids.length > 25,
      nextBefore: page.at(-1) ?? null,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export async function corporateMailboxPassword() {
  const saved = await rpc("read_corporate_mailbox_secret");
  return typeof saved === "string" && saved
    ? saved
    : optionalEnv("IONOS_IMAP_PASSWORD");
}
const ownsSender = (sender: string) => {
  const match = sender.match(/<([^<>]+)>/);
  return (
    (match?.[1] || sender).trim().toLowerCase() ===
    SITE.contactEmail.toLowerCase()
  );
};
/** Read provider history directly; this never sends, requeues or changes mail. */
export async function readApplicationMailbox(query: MailboxQuery) {
  const client = createCorporateMailClient(optionalEnv("RESEND_API_KEY"));
  if (query.providerId) {
    const result = await client.emails.get(query.providerId);
    if (result.error || !result.data || !ownsSender(result.data.from))
      throw Error("NOT_FOUND");
    const mail = result.data,
      preview = isAuthenticationCode(mail.subject)
        ? inertMessage("", codeOmitted)
        : messagePreview(mail.html || "", mail.text || "", mail.subject);
    return {
      connected: true,
      source: "resend",
      message: {
        id: mail.id,
        subject: text(mail.subject),
        from: [mail.from],
        to: mail.to,
        date: mail.created_at,
        ...preview,
        state: mail.last_event,
        bodyAvailable: true,
        attachments: [],
      },
      checkedAt: new Date().toISOString(),
    };
  }
  const result = await client.emails.list({
    limit: 25,
    ...(query.after ? { after: query.after } : {}),
  });
  if (result.error || !result.data) throw Error("MAILBOX_PROVIDER_UNAVAILABLE");
  const rows = result.data.data;
  return {
    connected: true,
    source: "resend",
    items: rows
      .filter((mail) => ownsSender(mail.from))
      .filter(
        (mail) =>
          !query.q ||
          `${mail.subject} ${mail.to.join(" ")}`
            .toLowerCase()
            .includes(query.q.toLowerCase()),
      )
      .map((mail) => ({
        id: mail.id,
        subject: text(mail.subject),
        from: [mail.from],
        to: mail.to,
        date: mail.created_at,
        seen: true,
        state: mail.last_event,
      })),
    hasMore: result.data.has_more,
    nextAfter: rows.at(-1)?.id ?? null,
    checkedAt: new Date().toISOString(),
    coverage:
      "Historial que conserva el proveedor para el remitente corporativo. Las comunicaciones archivadas por la aplicación se consultan también en Comunicaciones.",
  };
}
