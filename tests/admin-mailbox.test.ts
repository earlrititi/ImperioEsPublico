import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  corporateImapOptions,
  mailboxQuery,
  readCorporateMailbox,
} from "../src/lib/admin-mailbox";
import { AUTH_REAUTHENTICATION_SUBJECT } from "../src/lib/auth-mail-catalog";

function fixture() {
  const calls: { method: string; args: any[] }[] = [],
    folders = [
      {
        path: "INBOX",
        name: "Entrada",
        flags: new Set(),
        specialUse: "\\Inbox",
      },
      {
        path: "INBOX.Enviados",
        name: "Enviados",
        flags: new Set(),
        specialUse: "\\Sent",
      },
    ],
    envelope = {
      subject: "Consulta <script>alert(1)</script>",
      from: [{ address: "client@example.invalid" }],
      to: [{ address: "contacto@imperioes.com" }],
      date: new Date("2026-11-01T10:00:00Z"),
    };
  const client: any = {
    on: () => undefined,
    connect: async () => {
      calls.push({ method: "connect", args: [] });
    },
    list: async () => folders,
    mailboxOpen: async (...args: any[]) => {
      calls.push({ method: "open", args });
      return { readOnly: true, uidValidity: 123n, exists: 40 };
    },
    search: async (...args: any[]) => {
      calls.push({ method: "search", args });
      return Array.from({ length: 40 }, (_, i) => i + 1);
    },
    fetch: async function* (range: string, query: any, options: any) {
      calls.push({ method: "fetch", args: [range, query, options] });
      for (const uid of range.split(",").map(Number))
        yield {
          uid,
          envelope,
          flags: new Set(),
          internalDate: envelope.date,
          size: 600,
        };
    },
    fetchOne: async (...args: any[]) => {
      calls.push({ method: "fetchOne", args });
      return {
        uid: 7,
        envelope,
        size: 20_000_000,
        bodyStructure: {
          type: "multipart/mixed",
          childNodes: [
            { part: "1", type: "text/html", size: 120 },
            {
              part: "2",
              type: "application/pdf",
              disposition: "attachment",
              dispositionParameters: { filename: "receipt.pdf" },
              size: 19_000_000,
            },
          ],
        },
      };
    },
    download: async (...args: any[]) => {
      calls.push({ method: "download", args });
      return {
        meta: { contentType: "text/html", charset: "utf-8" },
        content: Readable.from([
          '<p>Hello</p><script>bad()</script><img src="https://tracker.example/pixel"><a href="https://example.invalid/auth/reset?token=secret">Open</a>',
        ]),
      };
    },
    logout: async () => {
      calls.push({ method: "logout", args: [] });
    },
    close: () => {
      calls.push({ method: "close", args: [] });
    },
  };
  return {
    client,
    calls,
    factory: (options: any) => {
      assert.equal(options.secure, true);
      assert.equal(options.tls.rejectUnauthorized, true);
      assert.equal(options.port, 993);
      assert.equal(options.host, "imap.ionos.es");
      assert.equal(options.logger, false);
      return client;
    },
  };
}
test("query permits only bounded UIDs and literal folder/search values", () => {
  assert.equal(mailboxQuery(new URLSearchParams()).folder, "inbox");
  const invalid: Record<string, string>[] = [
    { before: "-1" },
    { uid: "4294967296" },
    { validity: "NaN" },
    { q: "x".repeat(101) },
    { folder: "../other" },
    { id: "arbitrary" },
  ];
  for (const input of invalid)
    assert.throws(() => mailboxQuery(new URLSearchParams(input)));
  const options = corporateImapOptions("synthetic-password");
  assert.equal(options.tls.minVersion, "TLSv1.2");
  assert.equal(options.auth.user, "contacto@imperioes.com");
});
test("read-only mailbox listing paginates metadata without downloading or setting flags", async () => {
  const f = fixture(),
    result: any = await readCorporateMailbox(
      mailboxQuery(new URLSearchParams({ q: '"literal search"' })),
      "fixture",
      f.factory,
    );
  assert.equal(result.items.length, 25);
  assert.equal(result.items[0].id, "40");
  assert.equal(result.hasMore, true);
  assert.equal(result.nextBefore, 16);
  assert.deepEqual(f.calls.find((c) => c.method === "open")?.args, [
    "INBOX",
    { readOnly: true },
  ]);
  assert.equal(
    f.calls.filter((c) => c.method === "download" || c.method === "fetchOne")
      .length,
    0,
  );
  assert.equal(f.calls.at(-1)?.method, "logout");
  assert.equal(
    f.calls.find((c) => c.method === "search")?.args[0].or[0].from,
    '"literal search"',
  );
});
test("sent folder is discovered by server special-use and UID generation mismatch is rejected", async () => {
  const f = fixture();
  await readCorporateMailbox(
    mailboxQuery(new URLSearchParams({ folder: "sent", before: "1" })),
    "fixture",
    f.factory,
  );
  assert.equal(
    f.calls.find((c) => c.method === "open")?.args[0],
    "INBOX.Enviados",
  );
  assert.equal(f.calls.filter((c) => c.method === "search").length, 0);
  await assert.rejects(
    readCorporateMailbox(
      mailboxQuery(new URLSearchParams({ validity: "999" })),
      "fixture",
      f.factory,
    ),
    /MAILBOX_RESET_REQUIRED/,
  );
});

test("unified index reads every matching UID as metadata and recognises Drafts without downloading bodies", async () => {
  const f = fixture(), originalList = f.client.list;
  f.client.list = async () => [...await originalList(), {
    path: "INBOX.Borradores", name: "Borradores", flags: new Set(),
  }];
  const result: any = await readCorporateMailbox(
    { ...mailboxQuery(new URLSearchParams()), allMetadata: true },
    "fixture", f.factory,
  );
  assert.equal(result.items.length, 40);
  assert.equal(result.hasMore, false);
  assert.equal(result.folders.find((folder: any) => folder.name === "Borradores").kind, "drafts");
  assert.equal(f.calls.filter(call => ["download", "fetchOne"].includes(call.method)).length, 0);
  assert.deepEqual(f.calls.find(call => call.method === "open")?.args, ["INBOX", { readOnly: true }]);
});
test("message reading fetches only a bounded text MIME part and blocks active/remote content", async () => {
  const f = fixture(),
    result: any = await readCorporateMailbox(
      mailboxQuery(new URLSearchParams({ uid: "7", validity: "123" })),
      "fixture",
      f.factory,
    );
  assert.equal(result.message.attachments[0].name, "receipt.pdf");
  assert.equal(result.message.bodyAvailable, true);
  assert.equal(f.calls.find((c) => c.method === "download")?.args[1], "1");
  assert.equal(
    f.calls.find((c) => c.method === "download")?.args[2].maxBytes,
    2 * 1024 * 1024,
  );
  assert.ok(!result.message.html.includes("<script>"));
  assert.ok(!result.message.html.includes('src="https://tracker'));
  assert.ok(!result.message.text.includes("token=secret"));
  assert.equal(
    f.calls.find((c) => c.method === "fetchOne")?.args[1].source,
    undefined,
  );
});
test("failed connection closes without logging credentials or attempting another host", async () => {
  const f = fixture();
  f.client.connect = async () => {
    throw Error("auth failure fixture");
  };
  await assert.rejects(
    readCorporateMailbox(
      mailboxQuery(new URLSearchParams()),
      "fixture",
      f.factory,
    ),
    /auth failure/,
  );
  assert.equal(f.calls.at(-1)?.method, "logout");
});
test("plain-text messages stay readable and literal markup cannot execute", async () => {
  const f = fixture();
  f.client.fetchOne = async () => ({
    uid: 7,
    envelope: { subject: "Plain", from: [], to: [] },
    bodyStructure: { part: "1", type: "text/plain", size: 60 },
  });
  f.client.download = async () => ({
    content: Readable.from([
      "First line\n<script>bad()</script>\npassword=private-secret",
    ]),
  });
  const result: any = await readCorporateMailbox(
    mailboxQuery(new URLSearchParams({ uid: "7" })),
    "fixture",
    f.factory,
  );
  assert.ok(result.message.html.includes("white-space:pre-wrap"));
  assert.ok(
    result.message.html.includes(
      "First line\n&lt;script&gt;bad()&lt;/script&gt;",
    ),
  );
  assert.ok(!result.message.html.includes("private-secret"));
  assert.equal(result.message.bodyAvailable, true);
});
test("outer body wins over forwarded messages and text attachments", async () => {
  const f = fixture();
  f.client.fetchOne = async () => ({
    uid: 7,
    envelope: { subject: "Forward", from: [], to: [] },
    bodyStructure: {
      type: "multipart/mixed",
      childNodes: [
        { part: "1", type: "text/plain", size: 20 },
        {
          part: "2",
          type: "message/rfc822",
          childNodes: [{ part: "2.1", type: "text/html" }],
        },
        {
          part: "3",
          type: "text/html",
          parameters: { name: "attachment.html" },
        },
      ],
    },
  });
  f.client.download = async (...args: any[]) => {
    f.calls.push({ method: "download", args });
    return { content: Readable.from(["Outer message"]) };
  };
  const result: any = await readCorporateMailbox(
    mailboxQuery(new URLSearchParams({ uid: "7" })),
    "fixture",
    f.factory,
  );
  assert.equal(f.calls.find((c) => c.method === "download")?.args[1], "1");
  assert.ok(result.message.html.includes("Outer message"));
  assert.equal(result.message.attachments[0].name, "attachment.html");
});
test("multipart alternatives prefer HTML and expose the actual preview truncation", async () => {
  const f = fixture();
  f.client.fetchOne = async () => ({
    uid: 7,
    envelope: { subject: "Long alternative", from: [], to: [] },
    bodyStructure: {
      type: "multipart/alternative",
      childNodes: [
        { part: "1", type: "text/plain" },
        { part: "2", type: "text/html", size: 220000 },
      ],
    },
  });
  f.client.download = async (...args: any[]) => {
    f.calls.push({ method: "download", args });
    return { content: Readable.from(["<p>" + "a".repeat(210000) + "</p>"]) };
  };
  const result: any = await readCorporateMailbox(
    mailboxQuery(new URLSearchParams({ uid: "7" })),
    "fixture",
    f.factory,
  );
  assert.equal(f.calls.find((c) => c.method === "download")?.args[1], "2");
  assert.equal(result.message.contentLimited, true);
});
test("authentication codes are omitted without downloading their MIME body", async () => {
  for (const subject of [
    AUTH_REAUTHENTICATION_SUBJECT,
    `[TEST - SIN COBRO REAL] ${AUTH_REAUTHENTICATION_SUBJECT}`,
    `[TEST - SIN COBRO REAL] [run:00000000-0000-4000-8000-000000000011] ${AUTH_REAUTHENTICATION_SUBJECT}`,
  ]) {
    const f = fixture();
    f.client.fetchOne = async () => ({
      uid: 7,
      envelope: { subject, from: [], to: [] },
      bodyStructure: { part: "1", type: "text/plain" },
    });
    const result: any = await readCorporateMailbox(
      mailboxQuery(new URLSearchParams({ uid: "7" })),
      "fixture",
      f.factory,
    );
    assert.equal(f.calls.filter((c) => c.method === "download").length, 0);
    assert.match(result.message.text, /omitido/);
  }
});
