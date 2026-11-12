import assert from "node:assert/strict";
import { test } from "node:test";
import { renderCorporateEmail } from "../src/lib/corporate-email";
import {
  AUTH_ARCHIVE_NOTICE,
  archiveMailboxQuery,
  readArchivedApplicationMailbox,
  safeArchivedMailBody,
} from "../src/lib/customer-mail-archive";

test("archive strips active resources and signed links while retaining order and coupon numbers", () => {
  const safe = safeArchivedMailBody({
    subject: "Tu código de descuento y pedido preparado",
    html: '<p>Pedido enviado.</p><script>active()</script><img src="https://tracker.example.invalid/pixel"><p>12<span>345678</span></p><a href="https://imperioes.com/reservas/gestionar#private-signed-link">Consultar</a>',
    text: "Pedido enviado. 12345678",
  });
  const copy = JSON.stringify(safe);
  for (const value of [
    "<script",
    "<img",
    "tracker.example",
    "private-signed-link",
  ])
    assert.ok(!copy.includes(value), value);
  assert.ok(safe.body_text.includes("Pedido enviado"));
  assert.ok(safe.body_html.includes("Pedido enviado"));
  assert.ok(safe.body_text.includes("12345678"));
});

test("Auth and Test-prefixed OTP copies contain only a generic notice", () => {
  for (const [subject, context] of [
    ["Aviso", { audit: false }],
    ["Aviso", { flow: "supabase_auth" }],
    ["Código para verificar tu identidad", {}],
    [
      "[TEST - SIN COBRO REAL] [run:00000000-0000-4000-8000-000000000011] Código para verificar tu identidad",
      {},
    ],
  ] as const) {
    const safe = safeArchivedMailBody(
      {
        subject,
        html: "<p>12345678 private-bearer</p>",
        text: "12345678 private-bearer",
      },
      context,
    );
    assert.equal(safe.body_text, AUTH_ARCHIVE_NOTICE);
    assert.ok(!JSON.stringify(safe).includes("12345678"));
    assert.ok(!JSON.stringify(safe).includes("private-bearer"));
  }
});

test("a normal corporate archive retains its approved layout through a second preview", () => {
  const subject = "Tu código de descuento y pedido 12345678";
  const rendered = renderCorporateEmail({
    subject,
    bodyHtml: "<p>Pedido 12345678. Descuento: IMPERIO10.</p>",
  });
  const copy = safeArchivedMailBody({ subject, ...rendered });
  const preview = safeArchivedMailBody({
    subject,
    html: copy.body_html,
    text: copy.body_text,
  });
  for (const html of [copy.body_html, preview.body_html]) {
    assert.ok(html.includes('data-imperio-email-layout="pergamino-v1"'));
    assert.ok(html.includes("cabecera-v2.png"));
    assert.ok(html.includes("firma-nao-v2.jpg"));
    assert.ok(html.includes("12345678"));
    assert.ok(html.includes("IMPERIO10"));
  }
});

test("archive query bounds pagination and rejects filter syntax", () => {
  assert.deepEqual(
    archiveMailboxQuery(
      new URLSearchParams({ q: "owner@example.invalid", page: "2" }),
    ),
    { id: "", q: "owner@example.invalid", page: 2 },
  );
  const invalidCases: Record<string, string>[] = [
    { page: "-1" },
    { page: "10001" },
    { q: "x),direction.eq.inbound" },
    { id: "arbitrary:00000000-0000-4000-8000-000000000001" },
  ];
  for (const params of invalidCases)
    assert.throws(
      () => archiveMailboxQuery(new URLSearchParams(params)),
      /INVALID_INPUT/,
    );
});

test("historical metadata has an honest missing-body notice and Auth hides even legacy bodies", async () => {
  for (const flow of ["commerce", "supabase_auth"]) {
    const row = {
      id: "customer_mail_deliveries:00000000-0000-4000-8000-000000000001",
      source: "customer_mail_deliveries",
      flow,
      subject: "Aviso registrado",
      email: "owner@example.invalid",
      ...(flow === "supabase_auth"
        ? { body_html: "<p>12345678</p>", body_text: "12345678" }
        : {}),
    };
    const seen: unknown[] = [];
    const chain: any = {
      select: () => chain,
      eq: (...args: unknown[]) => {
        seen.push(args);
        return chain;
      },
      maybeSingle: async () => ({ data: row, error: null }),
    };
    const db = {
      from: (table: string) => {
        assert.equal(table, "admin_communication_records");
        return chain;
      },
    };
    const response = await readArchivedApplicationMailbox(
      { id: row.id, q: "", page: 0 },
      db,
    );
    assert.deepEqual(seen[0], ["direction", "outbound"]);
    assert.equal(response.message?.bodyAvailable, false);
    assert.equal(
      response.message?.omissionReason,
      flow === "supabase_auth"
        ? "El contenido de autenticación se omite por seguridad."
        : "El cuerpo original no se conserva en el archivo local.",
    );
    assert.ok(!JSON.stringify(response).includes("12345678"));
  }
});
