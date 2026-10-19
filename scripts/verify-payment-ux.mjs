import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { Socket } from 'node:net';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

Socket.prototype.connect = () => { throw new Error('No real network in payment UX fixtures'); };
const env = parseEnv(readFileSync('.env.local', 'utf8'));
Object.assign(process.env, { PUBLIC_SITE_URL: 'https://imperioes.com', PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  RESERVATION_MODE: 'false', COMMERCE_EMAIL_MODE: 'disabled', STRIPE_SECRET_KEY: 'sk_test_fixture', RATE_LIMIT_SECRET:'fixture' });
const user = { id: '00000000-0000-4000-8000-000000000011', email: 'fixture@example.invalid',
  email_confirmed_at: '2026-10-12T00:00:00Z', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const session = { access_token: `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp,role:'authenticated'})}.fixture`,
  refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user };
const project = new URL(env.PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const cookie = `sb-${project}-auth-token=base64-${encode(session)}`;
let status = 'active', fail = false, subscriptionReads = 0;
let purchaseMode = 'live';
const fixtureToken = 'c'.repeat(64);
const address = { name:'Cliente Prueba',line1:'Calle Pruebas 12',line2:'',postalCode:'28001',city:'Madrid',province:'28',country:'ES' };
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname === '/auth/v1/user') return Response.json(user);
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit') return Response.json(true);
  if (url.pathname === '/rest/v1/reservations') {
    const id = url.searchParams.get('id')?.replace(/^eq\./, '') ?? '';
    const pending = id.endsWith('2'), paid = id.endsWith('3');
    const orderId = '00000000-0000-4000-8000-000000000004';
    const sessionId = purchaseMode === 'test' ? 'cs_test_fixture' : 'cs_live_fixture';
    return Response.json({id,user_id:null,number:'PRUEBA-SIN-COBRO',status:paid?'CONVERTED_TO_ORDER':pending?'PAYMENT_PENDING':'PURCHASE_AVAILABLE',
      token_hash:createHash('sha256').update(fixtureToken).digest('hex'),customer_name:address.name,customer_email:'fixture@example.invalid',
      total_price_snapshot:2999,shipping_address:address,reservation_payment_attempts:[],marketing_consent:false,
      reservation_items:[{sku:'IE-CAMISETA-IMPERIAL-M',size:'M',quantity:1,unit_price_snapshot:2999}],
      order_id:paid?orderId:null,stripe_checkout_session_id:sessionId,stripe_payment_intent_id:'pi_fixture',
      commerce_orders:paid?{id:orderId,reservation_id:id,number:'PEDIDO-PRUEBA',status:'PAID',shipping_address:address,
        total_quantity:1,subtotal:2999,total:2999,vat_amount:520,discount_amount:0,currency:'eur',
        paid_at:new Date(Date.now()-(purchaseMode==='old'?25*3600000:0)).toISOString(),refunded_amount:purchaseMode==='refunded'?2999:0,
        stripe_checkout_session_id:sessionId,stripe_payment_intent_id:'pi_fixture',commerce_order_items:[{
          sku:'IE-CAMISETA-IMPERIAL-M',size:'M',quantity:1,unit_price:2999,line_total:2999,currency:'eur'}]}:null});
  }
  if (url.pathname === '/rest/v1/subscriptions') {
    assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`);
    subscriptionReads++;
    return fail ? Response.json({message:'fixture failure'}, {status:503}) : Response.json({plan:'arcabucero',status,user_id:user.id});
  }
  throw new Error(`Unexpected fixture request ${url.pathname}`);
};
const { default: app } = await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
const check = async (credentials = '', suffix = '') => app.fetch(new Request(`https://imperioes.com/api/subscriptions/status${suffix}`,
  { headers: credentials ? { cookie: credentials } : {} }));
let response = await check('', '?session_id=cs_live_forged&email=other@example.invalid');
assert.deepEqual(await response.json(), {state:'sign_in'});
assert.equal(subscriptionReads, 0);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
response = await check(cookie);
assert.deepEqual(await response.json(), {state:'active'});
for (status of ['incomplete','unpaid','past_due','canceled','legacy_unverified']) {
  response = await check(cookie); assert.deepEqual(await response.json(), {state:'pending'});
}
fail = true; response = await check(cookie); assert.equal(response.status, 503);
assert.equal((await response.json()).state, undefined);
response = await app.fetch(new Request('https://imperioes.com/gracias?session_id=cs_live_forged'));
assert.equal(response.headers.get('cache-control'), 'private, no-store');
const html = await response.text();
assert.match(html, /Estamos comprobando tu acceso/);
assert.doesNotMatch(html, /Acceso premium activado/);
const view = (suffix, token = fixtureToken) => app.fetch(new Request(`https://imperioes.com/api/reservations/00000000-0000-4000-8000-00000000000${suffix}`, {
  method:'POST',headers:{Origin:'https://imperioes.com','Content-Type':'application/json'},body:JSON.stringify({action:'view',token}) }));
for (const suffix of ['1','2']) {
  response = await view(suffix); assert.equal(response.status,200); assert.equal((await response.json()).analyticsPurchase,null);
}
response = await view('3', 'wrong-token'); assert.equal(response.status,404);
assert.equal((await response.json()).analyticsPurchase,undefined);
response = await view('3'); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
const purchase = (await response.json()).analyticsPurchase;
assert.match(purchase.transaction_id,/^ie_[a-f0-9]{64}$/);
assert.equal(purchase.value,22.31); assert.equal(purchase.tax,5.2); assert.equal(purchase.shipping,2.48);
assert.doesNotMatch(JSON.stringify(purchase),/Cliente|fixture@example|Calle|28001|cs_live|pi_fixture/);
response = await view('3'); assert.deepEqual((await response.json()).analyticsPurchase,purchase);
for (purchaseMode of ['test','old','refunded']) {
  response = await view('3'); assert.equal(response.status,200); assert.equal((await response.json()).analyticsPurchase,null);
}
purchaseMode = 'live';
console.log('Payment confirmation and 8 purchase-receipt API scenarios passed. No Stripe charges, network or real emails.');
if (process.argv.includes('--browser')) {
  fail = false; status = 'active';
  const root = resolve('.vercel/output/static');
  const types = {'.js':'text/javascript','.css':'text/css','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'};
  const server = createServer(async (request, reply) => {
    try {
      const url = new URL(request.url, 'http://localhost:4338');
      const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (file.startsWith(root + sep)) {
        try {
          const bytes = readFileSync(file);
          reply.setHeader('Content-Type', types[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream');
          reply.end(bytes); return;
        } catch {}
      }
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const response = await app.fetch(new Request(url, {method:request.method,headers:request.headers,
        body:chunks.length?Buffer.concat(chunks):undefined}));
      reply.writeHead(response.status, Object.fromEntries(response.headers));
      reply.end(Buffer.from(await response.arrayBuffer()));
    } catch { reply.writeHead(500); reply.end('Fixture error'); }
  });
  server.listen(4338, '127.0.0.1', () => console.log('Read-only UX fixtures: http://localhost:4338 ; q to stop. All external network is blocked.'));
  process.stdin.resume();
  process.stdin.on('data', data => { if (data.toString().trim() === 'q') server.close(() => process.exit(0)); });
}
