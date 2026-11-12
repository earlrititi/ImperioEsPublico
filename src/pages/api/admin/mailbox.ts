import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { SITE } from "../../../config/site";
import { auditAdmin } from "../../../lib/admin-data";
import {
  corporateMailboxPassword,
  mailboxQuery,
  readApplicationMailbox,
  readCorporateMailbox,
} from "../../../lib/admin-mailbox";
import {
  failure,
  limited,
  privateJson,
  requestBody,
  requireAdmin,
  rpc,
} from "../../../lib/reservations";
export const prerender = false;
const mailboxFailure = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";
  if (
    [
      "FORBIDDEN",
      "INVALID_INPUT",
      "ORIGIN_NOT_ALLOWED",
      "RATE_LIMITED",
    ].includes(code)
  )
    return failure(error);
  const allowed = [
    "NOT_FOUND",
    "MAILBOX_FOLDER_NOT_FOUND",
    "MAILBOX_RESET_REQUIRED",
    "MAILBOX_MESSAGE_TOO_LARGE",
  ];
  return privateJson(
    { error: allowed.includes(code) ? code : "MAILBOX_CONNECTION_FAILED" },
    code === "NOT_FOUND" ? 404 : code === "MAILBOX_RESET_REQUIRED" ? 409 : 502,
  );
};
export const GET: APIRoute = async (context) => {
  try {
    const actor = await requireAdmin(context);
    await limited(context.request, "admin_mailbox_read", 60);
    const query = mailboxQuery(context.url.searchParams);
    await auditAdmin(
      actor.id,
      "communications",
      randomUUID(),
      "ADMIN_PRIVATE_READ",
    );
    if (query.folder === "application")
      return privateJson(await readApplicationMailbox(query));
    const password = await corporateMailboxPassword();
    if (!password)
      return privateJson({
        connected: false,
        source: "ionos",
        address: SITE.contactEmail,
        items: [],
        folders: [],
        message: null,
      });
    return privateJson({
      ...(await readCorporateMailbox(query, password)),
      address: SITE.contactEmail,
    });
  } catch (error) {
    return mailboxFailure(error);
  }
};
export const POST: APIRoute = async (context) => {
  try {
    const actor = await requireAdmin(context);
    if (!context.request.headers.get("origin")?.trim())
      throw Error("ORIGIN_NOT_ALLOWED");
    await limited(context.request, "admin_mailbox_connect", 5);
    const body = await requestBody(context.request, 8192);
    if (
      body.action !== "connect" ||
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 4096
    )
      throw Error("INVALID_INPUT");
    // Check EXAMINE/TLS before replacing the encrypted credential. Do not fetch
    // a message, set flags or persist any mail during connection setup.
    const probe = mailboxQuery(
      new URLSearchParams({ folder: "inbox", before: "1" }),
    );
    await readCorporateMailbox(probe, body.password);
    await rpc("store_corporate_mailbox_secret", { p_password: body.password });
    await auditAdmin(
      actor.id,
      "communications",
      randomUUID(),
      "MAILBOX_CONNECTED_READ_ONLY",
    );
    return privateJson({ connected: true, address: SITE.contactEmail });
  } catch (error) {
    return mailboxFailure(error);
  }
};
