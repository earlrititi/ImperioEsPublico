import { randomUUID } from "node:crypto";
import type { APIContext } from "astro";
import { database, failure, limited, optionalEnv, privateJson, requestBody, requireAdmin, rpc } from "./reservations";
import { auditAdmin } from "./admin-data";
import { COMMUNICATION_SOURCES, csvCell, dashboardQuery, inertMessage, redactedText } from "./communications-model";
import { normalizeEmail, validEmail } from "./newsletter-audience";

const MESSAGE_COLUMNS = "id,source,source_id,direction,created_at,occurred_at,sent_at,last_provider_check,sender,email,recipient_email,customer_name,subject,subject_available,type,flow,stage,source_status,state,delivery_status,provider,provider_id,order_id,attempts,seen,in_reply_to";
const CONTACT_COLUMNS = "email,name,created_at,sources,user_id,consent_id,marketing_accepted_at,consent_source,verified_at,suppressed,suppression_reason,preference,state,welcome_step,welcome_status,next_mail_at,last_mail_at,order_count,shipped_at,customer_received_at";
type Query = ReturnType<typeof dashboardQuery>;
type DB = Awaited<ReturnType<typeof database>>;
function assertResult(result: {error: unknown}) { if (result.error) throw Error("COMMUNICATIONS_MIGRATION_REQUIRED"); }
function filterQuery(q: any, filters: Query, audience = false) {
  if (filters.q) {
    const search = filters.q.replace(/_/g, "\\_");
    q = q.or(`${audience ? "name" : "customer_name"}.ilike.%${search}%,email.ilike.%${search}%${audience ? "" : `,sender.ilike.%${search}%,subject.ilike.%${search}%`}`);
  }
  if (filters.state) q = q.eq("state", filters.state);
  if (filters.source) q = audience ? q.contains("sources", [filters.source]) : q.eq("source", filters.source);
  if (filters.stage) q = q.eq(audience ? "welcome_step" : "stage", filters.stage);
  if (!audience) {
    if (filters.direction) q = q.eq("direction", filters.direction);
    if (filters.replies) q = q.not("in_reply_to", "is", null);
    for (const [input, column] of [["sender", "sender"], ["provider", "provider"], ["flow", "flow"], ["order", "order_id"], ["type", "type"]] as const) {
      if (filters[input]) q = q.eq(column, filters[input]);
    }
  }
  const dateColumn = audience ? "created_at" : "occurred_at";
  if (filters.from) q = q.gte(dateColumn, `${filters.from}T00:00:00Z`);
  if (filters.to) q = q.lt(dateColumn, new Date(Date.parse(filters.to) + 86400000).toISOString());
  return q;
}
export async function readDashboardPage(params: URLSearchParams, audience = false, db?: DB) {
  const filters = dashboardQuery(params, audience);
  if (filters.from && filters.to && filters.from > filters.to) throw Error("INVALID_INPUT");
  // These service-only SQL views intentionally do not reuse the queue write types.
  const client: any = db ?? await database();
  let query: any = client.from(audience ? "admin_audience_contacts" : "admin_communication_records")
    .select(audience ? CONTACT_COLUMNS : MESSAGE_COLUMNS, {count: "exact"});
  query = filterQuery(query, filters, audience)
    .order(audience ? "created_at" : "occurred_at", {ascending: filters.sort === "oldest"})
    .order(audience ? "email" : "id", {ascending: true})
    .range(filters.page * filters.pageSize, filters.page * filters.pageSize + filters.pageSize - 1);
  const result = await query; assertResult(result);
  return {items: (result.data ?? []).map((row: any) => ({...row, subject: row.subject ? redactedText(row.subject, 500) : undefined})), total: result.count ?? 0, page: filters.page, pageSize: filters.pageSize};
}

export async function communicationCoverage(db?: DB) {
  const client = db ?? await database();
  const [records, mailboxes] = await Promise.all([
    client.from("admin_communication_coverage").select("source,records,history_from,latest_record,last_provider_check,provider_identified,confirmed_delivered"),
    client.from("communication_mailboxes").select("id,label,provider,mailbox,enabled,import_since,retention_days,last_sync_at,state"),
  ]);
  assertResult(records); assertResult(mailboxes);
  const current = new Date().toISOString();
  return {
    checked_at: current,
    sources: COMMUNICATION_SOURCES.filter(s => s !== "mailbox").map(source => ({source, ...records.data?.find((r: any) => r.source === source), records: records.data?.find((r: any) => r.source === source)?.records ?? 0})),
    mailboxes: mailboxes.data ?? [],
    inbound_connected: Boolean(mailboxes.data?.some((m: any) => m.enabled && m.last_sync_at && m.state === "ready")),
    limitations: [
      "Historial local conservado en las fuentes indicadas. No se ha importado el historial completo de Resend ni mensajes manuales externos.",
      "Los registros de comercio, recursos y cupones pueden conservar solo la referencia de plantilla, sin el asunto/cuerpo original ni confirmación de entrega.",
      "El historial local de IONOS no se ha sincronizado. La consulta directa está disponible en Buzón tras conectar la cuenta; no importa mensajes al historial de Comunicaciones.",
      "El transporte central conserva metadatos prospectivos, sin cuerpos ni enlaces firmados. Los correos externos y los avisos antiguos sin registro local siguen fuera de cobertura. Los destinatarios administrativos no se deducen del cliente del pedido.",
      "Aperturas/clics históricos son señales parciales y no acreditan lectura. Solo el evento delivered acredita entrega.",
    ],
  };
}

export async function communicationDetail(id: string, db?: DB) {
  if (!/^(email_logs|marketing_automation_jobs|marketing_email_verifications|marketing_subscription_notices|post_delivery_jobs|commerce_outbox|manifesto_requests|marketing_leads|paid_order_admin_outbox|seo_jobs|customer_mail_deliveries|mailbox):[a-f0-9-]{36}$/.test(id)) throw Error("INVALID_INPUT");
  const client = db ?? await database();
  const result = await client.from("admin_communication_records").select(`${MESSAGE_COLUMNS},body_html,body_text,internet_message_id,error`).eq("id", id).maybeSingle();
  assertResult(result); if (!result.data) throw Error("NOT_FOUND");
  const row: any = result.data;
  const {body_html, body_text, error, ...summary} = row;
  const preview = inertMessage(body_html, body_text);
  // No token-bearing provider payload, raw headers, addresses or encrypted snapshots are returned.
  const relatedIds = [row.internet_message_id, row.in_reply_to].filter(Boolean);
  let related: any[] = [];
  if (relatedIds.length) {
    const replies = await client.from("admin_communication_records").select(MESSAGE_COLUMNS).in("internet_message_id", relatedIds).neq("id", id).limit(30);
    assertResult(replies); related = replies.data ?? [];
    if (row.internet_message_id) {
      const children = await client.from("admin_communication_records").select(MESSAGE_COLUMNS).eq("in_reply_to", row.internet_message_id).neq("id", id).limit(30);
      assertResult(children); related.push(...(children.data ?? []));
    }
  }
  const unique = [...new Map(related.map(r => [r.id, r])).values()];
  let attachments: any[] = [];
  if (row.source === "mailbox") {
    const inbound = await client.from("communication_inbound_messages").select("attachments,recipients").eq("id", row.source_id).single();
    assertResult(inbound);
    attachments = (inbound.data?.attachments ?? []).map((a: any) => ({name: redactedText(a.name, 180), size: Number(a.size) || 0, available: false}));
    summary.recipients = inbound.data?.recipients ?? [];
  }
  return {...summary, subject: redactedText(row.subject, 500), ...preview, body_available: Boolean(body_html || body_text),
    error: error ? (/^[A-Z0-9_:-]{1,100}$/.test(error) ? error : "Incidencia registrada; revisar en el sistema de origen") : null,
    tracking: ["opened", "clicked"].includes(row.delivery_status) ? row.delivery_status : null,
    related: unique.map(r=>({...r,subject:redactedText(r.subject,500)})), relation: unique.length ? "verified_header_reference" : "unlinked", attachments,
    events: [
      {at: row.created_at, state: "recorded", source: row.source},
      ...(row.sent_at ? [{at: row.sent_at, state: row.source_status === "recorded" ? "recorded" : "accepted_by_provider", source: row.source}] : []),
      ...(row.last_provider_check ? [{at: row.last_provider_check, state: row.state, source: "provider_reconciliation"}] : []),
    ],
    event_limit: "Se muestran los hitos conservados. Las colas históricas no almacenan cada webhook ni cada intento individual.",
  };
}

export async function audienceDetail(emailValue: string, pageValue: string | null, db?: DB) {
  const email = normalizeEmail(emailValue); if (!validEmail(email)) throw Error("INVALID_INPUT");
  const page = Number(pageValue ?? 0); if (!Number.isInteger(page) || page < 0 || page > 10000) throw Error("INVALID_INPUT");
  const client = db ?? await database();
  const [contact, timeline] = await Promise.all([
    client.from("admin_audience_contacts").select(`${CONTACT_COLUMNS},source_ids`).eq("email", email).maybeSingle(),
    client.from("admin_audience_timeline").select("id,source,occurred_at,label,status,detail", {count: "exact"}).eq("email", email).order("occurred_at", {ascending:false}).order("id").range(page * 25, page * 25 + 24),
  ]);
  assertResult(contact); assertResult(timeline); if (!contact.data) throw Error("NOT_FOUND");
  return {contact: contact.data, events: (timeline.data ?? []).map((r: any) => ({...r, label:redactedText(r.label, 500)})), total: timeline.count ?? 0, page, pageSize:25};
}

export type DashboardDependencies = {
  guard: typeof requireAdmin; audit: typeof auditAdmin; readPage: typeof readDashboardPage;
  coverage: typeof communicationCoverage; message: typeof communicationDetail; contact: typeof audienceDetail;
  totals: () => Promise<unknown>; canExport: (id: string) => boolean;
};
const dependencies: DashboardDependencies = {
  guard: requireAdmin, audit:async (...args) => { await rpc("prune_communications_data"); await auditAdmin(...args); }, readPage:readDashboardPage, coverage:communicationCoverage,
  message:communicationDetail, contact:audienceDetail,
  totals: async () => { const result = await (await database()).from("admin_audience_totals").select("dimension,segment,total"); assertResult(result); return result.data ?? []; },
  canExport: id => optionalEnv("ADMIN_PII_EXPORT_IDS").split(",").map(v => v.trim()).includes(id),
};

export async function adminDashboardGet(context: APIContext, audience = false, deps: DashboardDependencies = dependencies) {
  try {
    const actor = await deps.guard(context);
    const entity = audience ? "audience" : "communications";
    // Minimal audit: no search strings, addresses or message contents.
    await deps.audit(actor.id, entity, randomUUID(), "ADMIN_PRIVATE_READ");
    if (context.url.searchParams.get("detail")) return privateJson(audience ? await deps.contact(context.url.searchParams.get("detail")!,context.url.searchParams.get("eventPage")) : await deps.message(context.url.searchParams.get("detail")!));
    if (context.url.searchParams.get("coverage") === "1") return privateJson(await deps.coverage());
    if (audience && context.url.searchParams.get("totals") === "1") return privateJson({items:await deps.totals()});
    return privateJson({...await deps.readPage(context.url.searchParams, audience), export_allowed: deps.canExport(actor.id), checked_at: new Date().toISOString()});
  } catch (error) { return dashboardFailure(error); }
}

export async function adminDashboardExport(context: APIContext, audience = false, deps: DashboardDependencies = dependencies) {
  try {
    const actor = await deps.guard(context);
    if (!deps.canExport(actor.id)) throw Error("FORBIDDEN");
    await limited(context.request, "admin_private_export", 5);
    const body = await requestBody(context.request);
    if (body.confirm !== "DESCARGAR" || typeof body.query !== "string" || body.query.length > 1000) throw Error("INVALID_INPUT");
    const params = new URLSearchParams(body.query); params.set("page", "0"); params.set("pageSize", "50");
    await deps.audit(actor.id, audience ? "audience" : "communications", randomUUID(), "ADMIN_LIMITED_EXPORT_MAX_50");
    const page = await deps.readPage(params, audience);
    const keys = audience ? ["email", "name", "state", "created_at", "verified_at", "welcome_step"] : ["occurred_at", "email", "subject", "state", "source", "provider_id"];
    const csv = [keys.map(csvCell).join(","), ...page.items.map((r: any) => keys.map(k => csvCell(r[k])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, {headers: {"Content-Type":"text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${audience ? "audiencia" : "comunicaciones"}-limitado.csv"`, "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff", "Referrer-Policy":"no-referrer"}});
  } catch (error) { return dashboardFailure(error); }
}

function dashboardFailure(error: unknown) {
  if (error instanceof Error && error.message === "COMMUNICATIONS_MIGRATION_REQUIRED") return privateJson({code:"COMMUNICATIONS_MIGRATION_REQUIRED", error:"Las vistas privadas de comunicaciones aún no están disponibles. Aplicar las migraciones revisadas en el entorno de pruebas. No se han cargado datos ficticios."},503);
  return failure(error);
}
