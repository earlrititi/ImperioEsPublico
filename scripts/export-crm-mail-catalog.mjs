/** Offline catalogue. Pure renderers only: no database, provider, credentials or live customer. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.argv[2] ?? join(root, 'tmp', 'crm-mail-review'));
let releaseState = {};
try { releaseState = JSON.parse((await readFile(join(output, 'production-state.json'), 'utf8')).replace(/^\uFEFF/, '')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
// Do not load .env files. The renderer only needs this synthetic signing key for example links.
process.env.RESERVATION_TOKEN_SECRET = 'offline-catalogue-fixture-key-not-for-use-in-any-environment';
process.env.EMAIL_PARCHMENT_ENABLED = 'true';
globalThis.fetch = async () => { throw Error('CATALOGUE_NETWORK_FORBIDDEN'); };
const { AUTOMATION_DEFAULTS, personalizeAutomation } = await import('../src/lib/email-automations.ts');
const { renderAdminMail } = await import('../src/lib/admin-mail-template.ts');
const { renderCustomerMail } = await import('../src/lib/customer-mail-catalog.ts');
const { authMailPlans } = await import('../src/lib/auth-mail-catalog.ts');
const { planStripeCustomerMail } = await import('../src/lib/stripe-customer-mail.ts');
const { reservationMailText } = await import('../src/lib/commerce-mail.ts');
const { postDeliveryMessage } = await import('../src/lib/post-delivery-worker.ts');
const { prepareCorporateEmail, CORPORATE_EMAIL_BRAND, CORPORATE_EMAIL_LAYOUT } = await import('../src/lib/corporate-email.ts');
const { RESERVATION_STATUS } = await import('../src/config/commerce.ts');
await mkdir(join(output, 'html'), { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHash = async source => sha(await readFile(join(root, source)));
const records = [];
const linksOf = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({ url: m[1].replaceAll('&amp;', '&'), label: m[2].replace(/<[^>]*>/g, '').trim() }));
async function add(id, family, trigger, segment, message, extra = {}) {
  const rendered = prepareCorporateEmail(message);
  const source = extra.source ?? 'src/lib/corporate-email.ts';
  const preheader = (rendered.html.match(/<div style="display:none[^\"]*">([^<]*)<\/div>/)?.[1] ?? '')
    .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
  const released = releaseState.coordinator_active === true && releaseState.welcome_approved === true;
  const activeAutomation = /^automation-(welcome|checkout|cart)-/.test(id);
  const inactiveAutomation = /^automation-(viewed_product|site)-/.test(id);
  const status = released && activeAutomation
    ? releaseState.commercial_paused === true
      ? 'ACTUAL PUBLICADO Y APROBADO; envío comercial temporalmente PAUSADO'
      : 'ACTUAL PUBLICADO Y APROBADO; envío solo si la cuenta conserva elegibilidad'
    : inactiveAutomation || id.startsWith('post-delivery-')
      ? 'ACTUAL EN CÓDIGO; familia desactivada en producción en el corte documentado'
      : 'ACTUAL EN CÓDIGO; este caso sintético no acredita una ejecución real (NO VERIFICADO)';
  const record = { id, family, trigger, segment,
    subject: message.subject, preheader, content: message.text ?? '', ...extra, status,
    version: extra.version ?? 'source-sha256', source, source_sha256: await sourceHash(source),
    rendered_sha256: sha(JSON.stringify({ subject: rendered.subject, html: rendered.html, text: rendered.text })),
    text: rendered.text, links: linksOf(rendered.html), preview: `html/${id}.html` };
  records.push(record);
  await writeFile(join(output, record.preview), rendered.html, 'utf8');
}
const gates = {
  welcome: 'Contacto o cuenta con permiso comercial y email verificado. Historial compartido; ofertas excluidas tras conversión relevante.',
  checkout: 'Identidad verificada, marketing y analítica vigentes; intención nueva autorizada; sin compra ni pago en curso. Comprobar Stripe y pedido.',
  cart: 'Identidad verificada, marketing y analítica vigentes; carrito actual no vacío; sin checkout posterior ni compra.',
  viewed_product: 'Identidad verificada, marketing y analítica vigentes; sin carrito, checkout o compra posterior.',
  site: 'Identidad verificada, marketing y analítica vigentes. Experimento de bajo volumen pendiente de aprobación.',
};
for (const definition of AUTOMATION_DEFAULTS) for (const step of definition.steps) {
  const content = personalizeAutomation(step.mail, 'Lectora de prueba');
  await add(`automation-${definition.key}-${step.id}`, 'Marketing / ' + definition.name,
    `${definition.key}.${step.id}; +${step.afterHours} h desde el ancla elegible`, gates[definition.key],
    { subject: content.subject, ...renderAdminMail(content, 'https://imperioes.com/comunicaciones/baja?token=FIXTURE_NO_VALIDO', true) },
    { source: 'src/lib/email-automations.ts', version: `revision-${definition.revision}`, afterHours: step.afterHours,
      preheader: step.mail.preheader, content: step.mail.content, cta_label: step.mail.cta_label, cta_url: step.mail.cta_url,
      sample: 'El cuerpo literal conserva {{nombre}}. HTML y texto renderizado usan Lectora de prueba; enlace de baja ficticio.' });
}
const customer = [
 ['tshirt_discount', [{ to: 'customer@example.invalid', name: 'Lectora de prueba', code: 'EJEMPLO15', percent: 15, reference: 'fixture15' }, 'https://imperioes.com'], 'Suscripción ARCABUCERO activada y descuento válido, una vez por derecho.'],
 ['tshirt_discount', [{ to: 'customer@example.invalid', name: 'Lectora de prueba', code: 'EJEMPLO20', percent: 20, reference: 'fixture20' }, 'https://imperioes.com'], 'Suscripción MAESTRE DE CAMPO activada y descuento válido, una vez por derecho.'],
 ['piquero_welcome', [{ to: 'customer@example.invalid', name: 'Lectora de prueba' }], 'Cuenta PIQUERO activa; no equivale a consentimiento comercial.'],
 ['paid_welcome', [{ to: 'customer@example.invalid', name: 'Lectora de prueba', planName: 'ARCABUCERO', priceSummary: '3,50 EUR al mes (ejemplo)', termsVersion: 'EJEMPLO' }, 'https://imperioes.com'], 'Activación de suscripción conciliada con Stripe.'],
 ['paid_welcome', [{ to: 'customer@example.invalid', name: 'Lectora de prueba', planName: 'MAESTRE DE CAMPO', priceSummary: '7 EUR al mes (ejemplo)', termsVersion: 'EJEMPLO' }, 'https://imperioes.com'], 'Activación de suscripción conciliada con Stripe.'],
 ['payment_failed', [{ to: 'customer@example.invalid' }], 'Fallo de pago contractual confirmado; no recuperación comercial.'],
 ['subscription_cancelled', [{ to: 'customer@example.invalid' }], 'Cancelación confirmada; conservar accesos que correspondan.'],
 ['merch_purchase', [{ to: 'customer@example.invalid', productName: 'Camiseta Imperial', size: 'M' }], 'Compra pagada; corrección de fecha caducada del PR #6.'],
];
for (let i = 0; i < customer.length; i++) {
  const [kind, args, trigger] = customer[i];
  await add(`customer-${kind}-${i}`, 'Servicio / cuenta y compra', trigger, 'Destinatario de la operación contractual; datos y precios de ejemplo.', renderCustomerMail(kind, ...args), { source: 'src/lib/customer-mail-catalog.ts' });
}
const actions = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'reauthentication', 'password_changed_notification', 'email_changed_notification', 'phone_changed_notification', 'identity_linked_notification', 'identity_unlinked_notification', 'mfa_factor_enrolled_notification', 'mfa_factor_unenrolled_notification'];
for (const action of actions) {
  const payload = { user: { email: 'customer@example.invalid', new_email: 'new@example.invalid' },
    email_data: { email_action_type: action, token: '12345678', token_new: '87654321', token_hash: 'FIXTURE_NO_VALIDO', token_hash_new: 'FIXTURE_ACTUAL_NO_VALIDO', old_email: 'old@example.invalid' } };
  for (const plan of authMailPlans(payload, { siteUrl: 'https://imperioes.com' })) {
    await add(`auth-${action}-${plan.slot}`, 'Seguridad / Supabase Auth', action, 'Hook firmado y destinatario correspondiente. Tokens sintéticos sin validez.', plan, { source: 'src/lib/auth-mail-catalog.ts' });
  }
}
const now = Date.parse('2026-11-23T10:00:00Z'), sec = Math.floor(now / 1000);
function stripeReader(overrides = {}) {
  const subscription = { id: 'sub_fixture', customer: 'cus_fixture', customer_email: 'customer@example.invalid', customer_name: 'Lectora de prueba', status: 'active', collection_method: 'charge_automatically', current_period_end: sec + 604800,
    metadata: { plan: 'arcabucero', billingInterval: 'month' }, items: { data: [{ current_period_end: sec + 604800, price: { id: 'price_fixture' } }] }, default_source: 'card_fixture', ...overrides.subscription };
  const invoice = { id: 'in_fixture', status: 'paid', customer_email: 'customer@example.invalid', customer_name: 'Lectora de prueba', parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_fixture' } }, number: 'EJEMPLO-0001', amount_paid: 3500, amount_remaining: 3500, amount_due: 3500, currency: 'eur', hosted_invoice_url: 'https://invoice.stripe.com/i/fixture', collection_method: 'send_invoice', ...overrides.invoice };
  const charge = { id: 'ch_fixture', customer: 'cus_fixture', paid: true, captured: true, amount: 2699, currency: 'eur', receipt_url: 'https://pay.stripe.com/receipts/fixture', metadata: { product: 'camiseta-imperial' }, billing_details: { name: 'Lectora de prueba', email: 'customer@example.invalid' } };
  const api = {
    invoices: { retrieve: async () => invoice }, subscriptions: { retrieve: async () => subscription, list: async () => ({ data: [subscription] }) },
    checkout: { sessions: { retrieve: async () => ({ id: 'cs_fixture', mode: 'payment', payment_status: 'paid', metadata: { product: 'camiseta-imperial' }, payment_intent: 'pi_fixture', customer_email: 'customer@example.invalid' }) } },
    paymentIntents: { retrieve: async () => ({ id: 'pi_fixture', status: 'succeeded', latest_charge: charge, metadata: { product: 'camiseta-imperial' } }) },
    charges: { retrieve: async () => charge }, refunds: { retrieve: async () => ({ id: 're_fixture', charge: 'ch_fixture', amount: 2699, currency: 'eur', status: overrides.refundStatus ?? 'succeeded' }) },
    customers: { retrieve: async () => ({ id: 'cus_fixture', name: 'Lectora de prueba', email: 'customer@example.invalid', default_source: 'card_fixture' }), retrieveSource: async () => ({ object: 'card', exp_year: 2026, exp_month: 11 }) },
    creditNotes: { retrieve: async () => ({ id: 'cn_fixture', invoice: 'in_fixture', amount: 1000, currency: 'eur', number: 'ABONO-EJEMPLO', status: overrides.noteStatus ?? 'issued', pdf: 'https://files.stripe.com/fixture.pdf' }) },
  };
  return { api, invoice, subscription };
}
const stripeCases = [
 ['invoice.paid', 'in_fixture', {}], ['invoice.payment_failed', 'in_fixture', { invoice: { status: 'open' } }],
 ['invoice.payment_action_required', 'in_fixture', { invoice: { status: 'open' } }], ['invoice.finalized', 'in_fixture', { invoice: { status: 'open' } }],
 ['checkout.session.completed', 'cs_fixture', {}],
 ...['pending', 'requires_action', 'succeeded', 'failed', 'canceled'].map(refundStatus => ['refund.updated', 're_fixture', { refundStatus }]),
 ...['issued', 'void'].map(noteStatus => ['credit_note.updated', 'cn_fixture', { noteStatus }]),
 ['invoice.upcoming', 'in_fixture', {}],
 ['customer.subscription.trial_will_end', 'sub_fixture', { subscription: { status: 'trialing', trial_end: sec + 259200 } }],
 ['customer.subscription.deleted', 'sub_fixture', { subscription: { status: 'canceled' } }],
 ['customer.subscription.updated', 'sub_fixture', { subscription: { cancel_at_period_end: true, cancel_at: sec + 604800 } }],
 ['customer.source.expiring', 'card_fixture', {}],
];
for (let i = 0; i < stripeCases.length; i++) {
  const [type, id, overrides] = stripeCases[i], { api, invoice } = stripeReader(overrides);
  const object = type === 'invoice.upcoming' ? invoice : { id, customer: 'cus_fixture' };
  const event = { id: `evt_fixture_${i}`, type, created: sec, livemode: false, data: { object, previous_attributes: { cancel_at_period_end: false } } };
  const plans = await planStripeCustomerMail(event, api, now);
  if (!plans.length) throw Error(`EMPTY_STRIPE_FIXTURE:${type}:${i}`);
  for (const plan of plans) await add(`stripe-${plan.kind}-${i}`, 'Servicio / Stripe', `${type}; estado actual ${plan.guard.expected}`, 'Operación propia acreditada; lectura actual de Stripe; modo Test ficticio; nunca crea cargos.', plan.message, { source: 'src/lib/stripe-customer-mail.ts', idempotency: plan.key, sample: 'Importes, recursos y documentos de Stripe ficticios. Alias invoice.payment_succeeded / checkout.session.async_payment_succeeded reutilizan la misma clave lógica.' });
}
for (const status of ['WAITLIST', 'RESERVED', 'PURCHASE_AVAILABLE', 'PAYMENT_PENDING', 'PAYMENT_FAILED', 'CANCELLED', 'EXPIRED', 'PAID']) {
  const reservation = { id: '00000000-0000-4000-8000-000000000001', number: 'RES-EJEMPLO', status, customer_email: 'customer@example.invalid', total_price_snapshot: 2999, expires_at: '2026-12-01T18:00:00Z',
    reservation_items: [{ product_name: 'Camiseta Imperial', sku: 'EJEMPLO-M', size: 'M', color: 'Negra', quantity: 1, unit_price_snapshot: 2999 }],
    commerce_orders: status === 'PAID' ? { total: 2699, product_subtotal: 2699, shipping_amount: 0, shipping_method: 'standard', vat_amount: 468, discount_amount: 0 } : null };
  const subject = status === 'RESERVED' ? 'Tu camiseta Imperio E está reservada' : `${status === 'PAID' ? 'Pedido' : 'Reserva'} ${reservation.number}: ${RESERVATION_STATUS[status]}`;
  const text = reservationMailText(reservation, status, 'https://imperioes.com/reservas/gestionar#FIXTURE_NO_VALIDO');
  await add(`reservation-${status.toLowerCase()}`, 'Servicio / reserva y pedido', `commerce_outbox.kind=${status}; estado actual ${status}`, 'Titular de reserva/pedido; estado vigente y enlace de gestión seguro.', { subject, text }, { source: 'src/lib/commerce-mail.ts' });
}
for (const kind of ['delivery_check', 'post_delivery_loyalty']) {
  const job = { id: '00000000-0000-4000-8000-000000000011', order_id: '00000000-0000-4000-8000-000000000012', kind, recipient: 'customer@example.invalid', order_number: 'PED-EJEMPLO', token_expires_at: '2026-12-01T10:00:00Z', claim_id: '00000000-0000-4000-8000-000000000013', template_digest: null };
  const message = postDeliveryMessage(job, process.env.RESERVATION_TOKEN_SECRET);
  await add(`post-delivery-${kind}`, kind === 'delivery_check' ? 'Servicio / recepción' : 'Marketing / fidelización', kind === 'delivery_check' ? '+48 h desde entrega logística verificada (configurable)' : '+72 h desde recepción confirmada (configurable)', 'Sin reembolso, devolución, disputa ni incidencia; fidelización exige elegibilidad comercial. Flags no se activan.', message, { source: 'src/lib/post-delivery-worker.ts' });
}
const metadata = { generated_at: new Date().toISOString(), review_date: '2026-11-23', git_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), production_state: releaseState, corporate_brand: CORPORATE_EMAIL_BRAND, corporate_layout: CORPORATE_EMAIL_LAYOUT, synthetic_only: true, network_forbidden: true, records };
await writeFile(join(output, 'catalog.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf8');
await writeFile(join(output, 'index.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><title>Catálogo de revisión CRM</title><style>body{font:16px/1.6 system-ui;max-width:900px;margin:40px auto;padding:20px}li{margin:12px 0}</style><h1>Catálogo de revisión CRM</h1><p>Ejemplos sintéticos, sin envío. No acreditan activación en producción.</p><ol>${records.map(r => `<li><a href="${r.preview}">${r.subject}</a> <small>${r.id}</small></li>`).join('')}</ol></html>`, 'utf8');
console.log(JSON.stringify({ output, templates: records.length, synthetic_only: true }));
