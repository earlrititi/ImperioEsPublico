import { AUTH_REAUTHENTICATION_SUBJECT } from "./auth-mail-catalog";
import { COMMUNICATION_SOURCES } from "./communications-labels";
import { redactedText } from "./communications-model";
import { messagePreview } from "./corporate-mail-preview";
import type { CorporateMailMessage } from "./corporate-mail-transport";
import { createCorporateMailClient } from "./corporate-mail-transport";

export const AUTH_ARCHIVE_NOTICE =
  "Aviso de seguridad enviado. El contenido, los enlaces de acceso y los códigos se omiten en esta copia de consulta.";
export type MailArchiveContext = {
  audit?: boolean;
  flow?: string;
  stage?: string;
};
export type MailArchiveBody = { body_html: string; body_text: string };
const withoutTestPrefix = (subject: string) =>
  subject
    .trim()
    .replace(/^\[TEST - SIN COBRO REAL\] (?:\[run:[a-f0-9-]{36}\] )?/, "");

/** Retain a bounded safe copy, preserving the approved corporate layout marker. */
export function safeArchivedMailBody(
  message: {
    subject?: string | null;
    html?: string | null;
    text?: string | null;
  },
  context: MailArchiveContext = {},
): MailArchiveBody {
  const subject = withoutTestPrefix(message.subject || "");
  const authentication =
    context.audit === false ||
    /(?:^|[_:-])auth(?:$|[_:-])/.test(context.flow || "") ||
    subject.toLowerCase() === AUTH_REAUTHENTICATION_SUBJECT.toLowerCase() ||
    /\b(?:otp|reauthentication|contraseña|contrasena|password|magiclink)\b/i.test(
      subject,
    ) ||
    /\/(?:auth\/|api\/auth\/)|\b(?:token_hash|access_token|refresh_token|verification_code)\b/i.test(
      `${message.html || ""}\n${message.text || ""}`,
    );
  if (authentication) {
    const preview = messagePreview("", AUTH_ARCHIVE_NOTICE);
    return { body_html: preview.html, body_text: AUTH_ARCHIVE_NOTICE };
  }
  const preview = messagePreview(
    message.html || "",
    message.text || "",
    subject,
  );
  const limited = preview.contentLimited
    ? "\n[Copia limitada por tamaño.]"
    : "";
  return {
    body_html: preview.html,
    body_text: preview.text + limited,
  };
}

/** An accepted delivery remains accepted if this optional archive is unavailable. */
export async function archiveAcceptedCustomerMail(
  database: unknown,
  key: string,
  message: CorporateMailMessage,
  context: MailArchiveContext,
) {
  const db = database as {
    from(table: "customer_mail_deliveries"): {
      update(body: MailArchiveBody): {
        eq(
          column: "key",
          value: string,
        ): {
          is(column: "body_html", value: null): PromiseLike<{ error: unknown }>;
        };
      };
    };
  };
  const result = await db
    .from("customer_mail_deliveries")
    .update(safeArchivedMailBody(message, context))
    .eq("key", key)
    .is("body_html", null);
  if (result.error) throw Error("CUSTOMER_MAIL_ARCHIVE_UNAVAILABLE");
}

export type ArchiveMailboxQuery = { id: string; q: string; page: number };
const validId = (id: string) => {
  const [source, uuid, extra] = id.split(":");
  return (
    !extra &&
    (COMMUNICATION_SOURCES as readonly string[]).includes(source) &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      uuid || "",
    )
  );
};
export function archiveMailboxQuery(
  params: URLSearchParams,
): ArchiveMailboxQuery {
  const id = params.get("id") || "",
    q = (params.get("q") || "").trim();
  const rawPage = params.get("page") || "0";
  if (
    (id && !validId(id)) ||
    q.length > 100 ||
    /[\u0000-\u001f\u007f(),%*\\]/.test(q) ||
    !/^\d{1,5}$/.test(rawPage) ||
    Number(rawPage) > 10_000
  )
    throw Error("INVALID_INPUT");
  return { id, q, page: Number(rawPage) };
}
const metadataColumns =
  "id,source,direction,sender,email,recipient_email,subject,occurred_at,sent_at,state,flow,stage,provider_id";
type ArchiveDatabase = { from(table: string): any };
const assertResult = (result: { error: unknown }) => {
  if (result.error) throw Error("MAIL_ARCHIVE_UNAVAILABLE");
};
const metadata = (row: any) => ({
  id: row.id,
  subject: redactedText(row.subject || "Asunto no conservado", 500),
  from: row.sender ? [redactedText(row.sender, 320)] : [],
  to:
    row.recipient_email || row.email ? [row.recipient_email || row.email] : [],
  date: row.sent_at || row.occurred_at,
  seen: true,
  state: row.state,
  source: row.source,
});

/** Local history only. No provider fetch, backfill or reconstruction of lost bodies. */
export async function readArchivedApplicationMailbox(
  query: ArchiveMailboxQuery,
  database?: ArchiveDatabase,
) {
  const validated = archiveMailboxQuery(
    new URLSearchParams({ id: query.id, q: query.q, page: String(query.page) }),
  );
  const db = database || (await (await import("./reservations")).database());
  const checkedAt = new Date().toISOString();
  const coverage =
    "Archivo local de envíos registrados por la web. Las copias nuevas están saneadas; los registros antiguos pueden conservar solo metadatos. No incluye correos externos ni reconstruye cuerpos perdidos.";
  if (validated.id) {
    const result = await db
      .from("admin_communication_records")
      .select(`${metadataColumns},body_html,body_text`)
      .eq("direction", "outbound")
      .eq("id", validated.id)
      .maybeSingle();
    assertResult(result);
    if (!result.data) throw Error("NOT_FOUND");
    const row = result.data;
    const authentication = row.flow === "supabase_auth";
    const bodyAvailable =
      !authentication && Boolean(row.body_html || row.body_text);
    // The marked archived layout is re-sanitized by the same preview adapter;
    // never pass it through the legacy text-only sanitizer a second time.
    const preview = authentication
      ? messagePreview("", AUTH_ARCHIVE_NOTICE)
      : bodyAvailable
        ? messagePreview(row.body_html || "", row.body_text || "", row.subject)
        : messagePreview(
            "",
            "El cuerpo original no se conserva en el archivo local.",
          );
    return {
      connected: true,
      source: "archive",
      checkedAt,
      coverage,
      message: {
        ...metadata(row),
        ...preview,
        bodyAvailable,
        attachments: [],
        omissionReason: authentication
          ? "El contenido de autenticación se omite por seguridad."
          : bodyAvailable
            ? null
            : "El cuerpo original no se conserva en el archivo local.",
      },
    };
  }
  let read = db
    .from("admin_communication_records")
    .select(metadataColumns, { count: "exact" })
    .eq("direction", "outbound");
  if (validated.q) {
    const search = validated.q.replace(/_/g, "\\_");
    read = read.or(`subject.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const result = await read
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: true })
    .range(validated.page * 25, validated.page * 25 + 24);
  assertResult(result);
  const total = result.count || 0;
  return {
    connected: true,
    source: "archive",
    checkedAt,
    coverage,
    items: (result.data || []).map(metadata),
    total,
    page: validated.page,
    hasMore: total > (validated.page + 1) * 25,
    nextPage: total > (validated.page + 1) * 25 ? validated.page + 1 : null,
  };
}

/** Repair missing copies without dispatching or changing an accepted delivery. */
export async function reconcileCustomerMailArchive(limit = 5) {
  const stats = {
    checked: 0,
    archived: 0,
    missing: 0,
    skipped: 0,
    rateLimited: false,
    unavailable: false,
  };
  try {
    const { database, optionalEnv } = await import("./reservations");
    const key = optionalEnv("RESEND_API_KEY");
    if (!key) return { ...stats, disabled: true };
    const count = Number.isFinite(limit)
      ? Math.max(1, Math.min(20, Math.floor(limit)))
      : 5;
    const db = await database();
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const result = await db
      .from("customer_mail_deliveries")
      .select("id,key,provider_id,recipient,flow")
      .eq("status", "sent")
      .is("body_html", null)
      .not("provider_id", "is", null)
      .neq("flow", "supabase_auth")
      .or(`provider_checked_at.is.null,provider_checked_at.lt.${cutoff}`)
      .order("provider_checked_at", { ascending: true, nullsFirst: true })
      .order("sent_at", { ascending: true })
      .limit(count);
    if (result.error) return { ...stats, unavailable: true };
    const provider = createCorporateMailClient(key);
    let nextRequest = 0;
    for (const row of result.data || []) {
      const checkedAt = new Date().toISOString();
      const markChecked = async () => {
        const marked = await db
          .from("customer_mail_deliveries")
          .update({ provider_checked_at: checkedAt })
          .eq("id", row.id)
          .is("body_html", null);
        if (marked.error) stats.unavailable = true;
      };
      if (!/^[a-f0-9-]{36}$/i.test(row.provider_id || "")) {
        stats.skipped++;
        await markChecked();
        continue;
      }
      const wait = Math.max(0, nextRequest - Date.now());
      if (wait)
        await new Promise<void>((done) => {
          setTimeout(done, wait);
        });
      nextRequest = Date.now() + 600;
      const detail = await provider.emails.get(row.provider_id);
      stats.checked++;
      if (detail.error?.statusCode === 429) {
        stats.rateLimited = true;
        break;
      }
      if (detail.error?.statusCode === 404) {
        stats.missing++;
        await markChecked();
        continue;
      }
      if (detail.error || !detail.data) {
        stats.unavailable = true;
        break;
      }
      const mail = detail.data;
      const sender = (mail.from.match(/<([^<>]+)>/)?.[1] || mail.from)
        .trim()
        .toLowerCase();
      const recipients = [
        ...mail.to,
        ...(mail.cc || []),
        ...(mail.bcc || []),
      ].map((address) =>
        (address.match(/<([^<>]+)>/)?.[1] || address).trim().toLowerCase(),
      );
      if (
        mail.id !== row.provider_id ||
        sender !== "contacto@imperioes.com" ||
        !recipients.includes(row.recipient)
      ) {
        stats.skipped++;
        await markChecked();
        continue;
      }
      const saved = await db
        .from("customer_mail_deliveries")
        .update({
          ...safeArchivedMailBody(mail, { flow: row.flow }),
          provider_checked_at: checkedAt,
        })
        .eq("id", row.id)
        .eq("provider_id", row.provider_id)
        .is("body_html", null)
        .select("id");
      if (saved.error) {
        stats.unavailable = true;
        break;
      }
      stats.archived += saved.data?.length || 0;
    }
    return stats;
  } catch {
    // Maintenance may retry later. No payload, identifier, address or upstream
    // diagnostic is logged, and this operation never invokes a send method.
    return { ...stats, unavailable: true };
  }
}
