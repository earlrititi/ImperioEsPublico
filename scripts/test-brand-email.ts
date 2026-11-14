import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { BRAND } from "../src/config/brand";
import { SITE } from "../src/config/site";
import { renderCorporateEmail, validateCorporateMessage } from "../src/lib/corporate-email";
import { createCorporateMailClient, sendCorporateMail } from "../src/lib/corporate-mail-transport";

// Only the address explicitly authorized in the rebranding request can be used.
// This tool never reads recipients from a database, mail queue or CLI argument.
if (process.argv.slice(2).some(arg => arg !== "--send")) throw Error("Only --send is supported; recipient and sender are fixed.");
const send = process.argv.includes("--send");
const subject = "[PRUEBA DE IDENTIDAD] Imperio Español — sin cobro";
const message = {
  from: `${BRAND.name} <${SITE.contactEmail}>`,
  to: "earlrititi@gmail.com",
  replyTo: SITE.contactEmail,
  subject,
  ...renderCorporateEmail({ subject, visualTitle: "Prueba de identidad oficial", bodyText: "Este correo comprueba únicamente la nueva identidad visual de Imperio Español. No crea pedidos, suscripciones ni cobros. Puedes responder a contacto@imperioes.com." }),
};
validateCorporateMessage(message);
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const assets = await Promise.all(Object.values(BRAND.email.logos).map(async url => {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15000) });
  const type = response.headers.get("content-type") ?? "";
  const local = await readFile(resolve("public", new URL(url).pathname.slice(1)));
  const matches = response.ok && type.startsWith("image/png") && digest(new Uint8Array(await response.arrayBuffer())) === digest(local);
  return { url, status: response.status, officialFileMatches: matches };
}));
const providerConfigured = Boolean(process.env.RESEND_API_KEY);
const ready = assets.every(asset => asset.officialFileMatches) && providerConfigured;
console.log(JSON.stringify({ mode: send ? "send" : "dry-run", from: message.from, to: message.to, providerConfigured, assets, ready }));
if (!send) process.exit(ready ? 0 : 2);
if (!ready) throw Error("BRAND_TEST_NOT_READY: publish the canonical official PNGs and configure the existing provider first.");
const response = await sendCorporateMail(createCorporateMailClient(process.env.RESEND_API_KEY!), message, { idempotencyKey: `brand-${BRAND.metadata.iconVersion}-single-approved-test` });
if (response.error || !response.data?.id) throw Error("BRAND_TEST_PROVIDER_REJECTED");
console.log(JSON.stringify({ acceptedByProvider: true, providerId: response.data.id, to: message.to }));
