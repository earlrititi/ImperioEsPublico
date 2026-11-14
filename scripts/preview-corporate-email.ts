import { mkdir, cp, writeFile, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { BRAND } from "../src/config/brand";
import { SITE } from "../src/config/site";
import { CORPORATE_EMAIL_ASSETS, escapeEmailHtml, renderCorporateEmail, prepareCorporateEmail } from "../src/lib/corporate-email";
import { renderCustomerMail } from "../src/lib/customer-mail-catalog";
import { authMailPlans } from "../src/lib/auth-mail-catalog";
import { AUTOMATION_DEFAULTS, personalizeAutomation } from "../src/lib/email-automations";
import { renderAdminMail } from "../src/lib/admin-mail-template";
import { paidOrderNotification, leadNotification, reservationNotification, subscriptionNotification } from "../src/lib/admin-notifications";
import { reservationMailText } from "../src/lib/commerce-mail";

// Pure local rendering: no provider, account, database, queue or payment operation.
const output = process.argv[2];
if (!output) throw Error("Pass an output directory for the local-only QA fixtures.");
await mkdir(join(output, "assets"), { recursive: true });
for (const url of Object.values(BRAND.email.logos)) {
  const filename = new URL(url).pathname.split("/").at(-1)!;
  await cp(resolve("public/brand/logos", filename), join(output, "assets", filename));
}
const sentence = "Navegantes, ciudades y archivos conservan las historias del Siglo de Oro. Acentos: España, expedición; signos: & < >; importe de ejemplo: 35 €.";
const fixtures: Record<string, { html: string; text: string }> = {
  empty: renderCorporateEmail({ empty: true }),
  short: renderCorporateEmail({ subject: "Prueba local de correo breve", visualTitle: "Gracias por leernos", bodyHtml: `<p>${escapeEmailHtml(sentence)}</p>` }),
  dark: renderCorporateEmail({ subject: "Prueba local de cabecera oscura", visualTitle: "Gracias por acompañarnos", headerTheme: "dark", bodyHtml: `<p>${escapeEmailHtml(sentence)}</p>` }),
  long: renderCorporateEmail({ subject: "Prueba local de correo largo", visualTitle: "Veinte párrafos de historia", bodyHtml: Array.from({ length: 20 }, (_, index) => `<p>${index + 1}. ${escapeEmailHtml(sentence.repeat(3))}</p>`).join("") }),
};
const to = "lector@example.invalid";
fixtures["customer-tshirt-discount"] = renderCustomerMail("tshirt_discount", { to, name: "Lector de prueba", code: "QA-IMPERIO", percent: 10, reference: "QA-001" }, BRAND.url);
fixtures["customer-welcome"] = renderCustomerMail("piquero_welcome", { to, name: "Lector de prueba" });
fixtures["customer-subscription"] = renderCustomerMail("paid_welcome", { to, name: "Lector de prueba", planName: "ARCABUCERO", priceSummary: "Importe ficticio: 35 €", termsVersion: "QA" }, BRAND.url);
fixtures["customer-payment-failed"] = renderCustomerMail("payment_failed", { to });
fixtures["customer-subscription-cancelled"] = renderCustomerMail("subscription_cancelled", { to });
fixtures["customer-merch-purchase"] = renderCustomerMail("merch_purchase", { to, productName: "Camiseta Imperial", size: "XL" });
const authActions = ["signup", "invite", "magiclink", "recovery", "email_change", "reauthentication", "password_changed_notification", "email_changed_notification", "phone_changed_notification", "identity_linked_notification", "identity_unlinked_notification", "mfa_factor_enrolled_notification", "mfa_factor_unenrolled_notification"];
for (const action of authActions) {
  const plans = authMailPlans({ user: { email: to, new_email: "nuevo@example.invalid" }, email_data: { email_action_type: action, token_hash: "qa-invalid-token-not-for-authentication", token_hash_new: "qa-invalid-new-token", token: "12345678", token_new: "87654321", old_email: "anterior@example.invalid" } }, { siteUrl: BRAND.url });
  for (const plan of plans) fixtures[`auth-${action}-${plan.slot}`] = plan;
}
for (const automation of AUTOMATION_DEFAULTS) for (const step of automation.steps) fixtures[`automation-${automation.key}-${step.id}`] = renderAdminMail(personalizeAutomation(step.mail, "Lector de prueba"), `${BRAND.url}/comunicaciones/baja?token=qa-invalid-fixture`, true);
const address = { name: "Lector de prueba", line1: "Calle de prueba 1", postalCode: "28001", city: "Madrid", province: "M" };
const reservation = { number: "QA-RESERVA-001", status: "RESERVED", customer_name: "Lector de prueba", customer_email: to, shipping_address: address, reservation_items: [{ size: "XL", quantity: 1, product_name: "Camiseta Imperial", sku: "QA-XL", color: "Negro", unit_price_snapshot: 2999 }], total_price_snapshot: 2999, expires_at: "2026-12-01T10:00:00Z" };
const management = `${BRAND.url}/reservas/gestionar#qa-invalid-fixture`;
fixtures.reservation = prepareCorporateEmail({ subject: "Tu reserva de prueba", text: reservationMailText(reservation, "RESERVED", management) });
fixtures.order = prepareCorporateEmail({ subject: "Pedido de prueba confirmado", text: reservationMailText({ ...reservation, status: "PAID", commerce_orders: { shipping_address: address, shipping_amount: 300, discount_amount: 0, product_subtotal: 2699, total: 2999, vat_amount: 520 } }, "PAID", management) });
fixtures["admin-reservation"] = prepareCorporateEmail(reservationNotification(reservation));
fixtures["admin-paid-order"] = prepareCorporateEmail(paidOrderNotification({ number: "QA-PEDIDO-001", customer_name: "Lector de prueba", customer_email: to, shipping_address: address, total_quantity: 1, total: 2999, currency: "eur", paid_at: "2026-11-14T10:00:00Z", status: "PAID", commerce_order_items: [{ size: "XL", quantity: 1, product_name: "Camiseta Imperial" }] }));
fixtures["admin-subscription"] = prepareCorporateEmail(subscriptionNotification({ id: "in_qa_fixture", customer_name: "Lector de prueba", customer_email: to }, "Arcabucero", "month"));
for (const kind of ["registration", "manifesto", "newsletter", "subscription_interest"] as const) fixtures[`admin-${kind}`] = prepareCorporateEmail(leadNotification({ kind, email: to, name: "Lector de prueba", plan: "PIQUERO" }));
fixtures.marketing = renderAdminMail({ subject: "Prueba local de novedades", preheader: "Historias del Siglo de Oro", content: "Prueba de maquetación de una campaña manual. No se ha enviado este mensaje.", cta_label: "Explorar el archivo", cta_url: `${BRAND.url}/archivo` }, `${BRAND.url}/comunicaciones/baja?token=qa-invalid-fixture`);
fixtures["delivery-check"] = renderCorporateEmail({ subject: "Prueba local de recepción", visualTitle: "¿Te ha llegado correctamente?", bodyHtml: '<p>Consulta tu pedido de prueba o comunica una incidencia desde tu cuenta.</p><p><a href="https://imperioes.com/cuenta">Consultar mi cuenta</a></p>' });
for (const name of ["confirmation", "recovery"]) {
  const fallback = await readFile(resolve(`production-environment/supabase/templates/${name}.html`), "utf8");
  fixtures[`supabase-fallback-${name}`] = { html: fallback.replaceAll("{{ .SiteURL }}", BRAND.url).replaceAll("{{ .TokenHash }}", "qa-invalid-fixture"), text: "Previsualización local de respaldo de Supabase. Token ficticio." };
}
const localHtml = (html: string) => html.replaceAll(CORPORATE_EMAIL_ASSETS, "./assets");
for (const [name, rendered] of Object.entries(fixtures)) {
  await writeFile(join(output, `${name}.html`), localHtml(rendered.html));
  await writeFile(join(output, `${name}.txt`), rendered.text);
}
await writeFile(join(output, "images-blocked.html"), localHtml(fixtures.short.html).replace(/<img\b[^>]*>/gi, '<span style="display:block;padding:10px">Imperio Español [imagen bloqueada]</span>'));
const links = [...Object.keys(fixtures), "images-blocked"];
const index = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Correos de Imperio Español · QA local</title><style>body{margin:0;padding:24px;background:#171312;color:#f5e9d5;font:16px/1.6 system-ui}a{color:#f7c17f}nav{display:flex;flex-wrap:wrap;gap:8px 16px}iframe{display:block;border:0;max-width:100%;margin:24px auto;background:#e8ddd0;width:600px;height:900px}label{margin-right:18px}</style></head><body><h1>Correos de Imperio Español</h1><p>Datos ficticios. Renderizado local de los catálogos existentes, sin envíos ni activación de automatizaciones. Los enlaces llevan tokens deliberadamente inválidos.</p><nav>${links.map(name => `<a href="${name}.html" target="email-preview">${name}</a>`).join("")}</nav><p><label>Ancho <select id="width">${[320,360,375,390,414,430,600,768,1024,1280,1440].map(n=>`<option ${n===600?"selected":""}>${n}</option>`).join("")}</select></label></p><iframe name="email-preview" title="Vista previa local de correo" sandbox="" src="order.html"></iframe><p>Revisión en navegador. No acredita pruebas reales en Gmail, Outlook o Apple Mail.</p><script>document.getElementById('width').onchange=e=>document.querySelector('iframe').style.width=e.target.value+'px';</script></body></html>`;
await writeFile(join(output, "index.html"), index);
const prepared = { from: `${BRAND.name} <${SITE.contactEmail}>`, to: "earlrititi@gmail.com", subject: "[PRUEBA DE IDENTIDAD] Imperio Español — sin cobro", ...renderCorporateEmail({ subject: "[PRUEBA DE IDENTIDAD] Imperio Español — sin cobro", visualTitle: "Prueba de identidad oficial", bodyText: "Este correo comprueba únicamente la nueva identidad visual de Imperio Español. No crea pedidos, suscripciones ni cobros." }) };
await writeFile(join(output, "prepared-test-message.json"), JSON.stringify(prepared, null, 2));
await writeFile(join(output, "README.md"), "# Previsualización local de correos\n\nAbre index.html. Los fixtures utilizan renderers y catálogos reales con datos ficticios. Los tokens son inválidos. No se ha enviado ningún mensaje. prepared-test-message.json prepara exclusivamente la prueba dirigida a earlrititi@gmail.com desde contacto@imperioes.com; no ejecuta el envío. Las notificaciones Stripe heredan el mismo layout y se verifican con sus pruebas existentes; este generador no llama a Stripe. Las plantillas de respaldo de Supabase requieren publicación independiente cuando corresponda. La revisión en navegador no acredita pruebas reales en Gmail, Outlook ni Apple Mail.\n");
const assetBytes = (await Promise.all(Object.values(BRAND.email.logos).map(url => stat(resolve("public", new URL(url).pathname.slice(1)))))).reduce((sum, file) => sum + file.size, 0);
console.log(JSON.stringify({ output: resolve(output), fixtures: links, assetBytes }));
