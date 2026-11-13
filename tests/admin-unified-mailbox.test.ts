import test from "node:test";
import assert from "node:assert/strict";
import type { APIContext } from "astro";
import {
  mergeUnifiedMessages,
  readUnifiedMailbox,
  unifiedMailboxGet,
  unifiedMailboxQuery,
  type UnifiedMailItem,
  type UnifiedMailboxDependencies,
} from "../src/lib/unified-mailbox";

const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const item = (number: number, overrides: Partial<UnifiedMailItem> = {}): UnifiedMailItem => ({
  reference: { source: "archive", id: `customer_mail_deliveries:${uuid(number)}` },
  direction: "outbound", subject: "Mismo asunto", from: ["contacto@imperioes.com"],
  to: ["persona@example.invalid"], date: `2026-11-01T10:${String(number % 60).padStart(2, "0")}:00.000Z`,
  provider: "resend", providerId: uuid(number), ...overrides,
});
const reader = (items: UnifiedMailItem[]): UnifiedMailboxDependencies => ({
  listSources: async () => [{ source: "archive", status: "connected", items }],
  readReference: async () => { throw Error("UNEXPECTED_DETAIL_READ"); },
  now: () => new Date("2026-11-13T12:00:00Z"),
});

test("unified metadata merges exact provider and Message-ID copies without subject/address heuristics", () => {
  const archive = item(1, { internetMessageId: "<exact@example.invalid>" });
  const provider = item(1, { reference: { source: "resend", id: uuid(1) }, internetMessageId: "<exact@example.invalid>" });
  const ionos = item(1, { reference: { source: "ionos", folder: "SU5CT1g", validity: 123, uid: 91 }, provider: null, providerId: null, internetMessageId: "<exact@example.invalid>" });
  const distinct = item(2), unknown = item(3, { providerId: null });
  const merged = mergeUnifiedMessages([archive, provider, ionos, distinct, unknown]);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.find(row => row.sources.length === 3)?.sources, ["archive", "ionos", "resend"]);
  assert.equal(merged.filter(row => row.subject === "Mismo asunto").length, 3);
  assert.equal(mergeUnifiedMessages([archive, { ...ionos, direction: "inbound" }]).length, 2);
});

test("one cursor sorts all sources by date, binds the search and excludes later arrivals", async () => {
  const items = Array.from({ length: 56 }, (_, number) => item(number + 1));
  items[0] = item(1, { direction: "inbound", reference: { source: "ionos", folder: "SU5CT1g", validity: 10, uid: 999 } });
  const deps = reader(items), first = await readUnifiedMailbox(unifiedMailboxQuery(new URLSearchParams({ q: "persona" })), deps);
  assert.equal(first.items?.length, 25);
  assert.equal(first.items?.[0].date, "2026-11-01T10:56:00.000Z");
  assert.equal(first.hasMore, true);
  assert.ok(first.nextCursor);
  items.push(item(999, { date: "2026-11-13T12:01:00Z" }));
  const second = await readUnifiedMailbox(unifiedMailboxQuery(new URLSearchParams({ q: "persona", cursor: first.nextCursor! })), deps);
  assert.equal(second.items?.length, 25);
  assert.equal(new Set([...(first.items || []), ...(second.items || [])].map(row => row.id)).size, 50);
  assert.equal(second.items?.[0].date, "2026-11-01T10:31:00.000Z");
  assert.throws(() => unifiedMailboxQuery(new URLSearchParams({ q: "changed", cursor: first.nextCursor! })), /INVALID_INPUT/);
  const inbound = await readUnifiedMailbox(unifiedMailboxQuery(new URLSearchParams({ filter: "inbound" })), deps);
  assert.equal(inbound.items?.length, 1);
  assert.equal(inbound.items?.[0].direction, "inbound");
});

test("stable opaque detail references try preserved copies first and never replace an Auth omission", async () => {
  const record = item(1, { reference: { source: "archive", id: `customer_mail_deliveries:${uuid(1)}`, providerId: uuid(1) } });
  const id = mergeUnifiedMessages([record])[0].id, calls: string[] = [];
  const deps = reader([]);
  deps.readReference = async ref => {
    calls.push(ref.source);
    return { message: ref.source === "archive" ? { html: "<p>Sin copia</p>", bodyAvailable: false } : { html: "<p>Copia disponible</p>", bodyAvailable: true } };
  };
  const detail = await readUnifiedMailbox(unifiedMailboxQuery(new URLSearchParams({ id })), deps);
  assert.deepEqual(calls, ["archive", "resend"]);
  assert.equal(detail.message?.id, id);
  assert.match(detail.message?.html || "", /Copia disponible/);
  calls.length = 0;
  deps.readReference = async ref => {
    calls.push(ref.source);
    return { message: { bodyAvailable: false, omissionReason: "El contenido de autenticación se omite por seguridad." } };
  };
  await readUnifiedMailbox(unifiedMailboxQuery(new URLSearchParams({ id })), deps);
  assert.deepEqual(calls, ["archive"]);
});

test("admin permission is enforced before parsing or touching any private mailbox dependency", async () => {
  const inaccessible = async (): Promise<never> => { throw Error("PRIVATE_SOURCE_MUST_NOT_BE_READ"); };
  const context = {
    url: new URL("https://imperioes.com/api/admin/mailbox?view=unified&id=invalid"),
    request: new Request("https://imperioes.com/api/admin/mailbox?view=unified"), cookies: {},
  } as APIContext;
  const response = await unifiedMailboxGet(context, {
    guard: async () => { throw Error("FORBIDDEN"); },
    limit: inaccessible, audit: inaccessible, read: inaccessible,
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
  assert.match(response.headers.get("cache-control") || "", /no-store/);
});

test("partial connection failures remain explicit while the available history stays readable", async () => {
  const deps = reader([item(1)]);
  deps.listSources = async () => [
    { source: "archive", status: "connected", items: [item(1)] },
    { source: "ionos", status: "not_configured", items: [] },
    { source: "resend", status: "unavailable", items: [] },
  ];
  const result = await readUnifiedMailbox(unifiedMailboxQuery(new URLSearchParams()), deps);
  assert.equal(result.needsConnection, true);
  assert.equal(result.items?.length, 1);
  assert.equal(result.warnings?.length, 1);
  assert.equal(result.connected, true);
});
