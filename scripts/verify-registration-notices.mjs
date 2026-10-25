import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { Socket } from 'node:net';

Socket.prototype.connect = () => { throw Error('No real network in registration fixtures'); };
Object.assign(process.env, {
  PUBLIC_SITE_URL: 'https://imperioes.com', PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  RATE_LIMIT_SECRET: 'fixture-rate-limit-secret', RESEND_API_KEY: 're_fixture', COMMERCE_EMAIL_MODE: 'live',
  AUTH_CAPTCHA_ENABLED: 'false',
});
const base = 'https://imperioes.com';
const id = '00000000-0000-4000-8000-000000000011';
const user = { id, email: 'reader@example.invalid', email_confirmed_at: null, created_at: '2026-10-24T10:00:00Z',
  aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [{ id: 'fixture-identity' }] };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const exp = Math.floor(Date.now()/1000)+3600;
const session = () => ({ user: { ...user }, access_token: `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,exp,role:'authenticated'})}.fixture`,
  refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp });
let verifier = '';
const pending = 'imperio_registration_consent=00000000-0000-4000-8000-000000000012';
const calls = [], sends = [], notices = [], events = new Map();
let userLookupFails = false, providerFails = false, authoritativeEmail = null, captchaEnforced = false;

globalThis.fetch = async (input, options) => {
  const request = input instanceof Request ? input : new Request(input, options);
  const url = new URL(request.url), method = request.method;
  const body = method === 'GET' ? null : await request.json();
  calls.push({ path: url.pathname, method, body });
  const json = (data, status=200) => Response.json(data, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit') return json(true);
  if (url.pathname === '/rest/v1/legal_consents') return json([]);
  if (url.pathname === `/auth/v1/admin/users/${id}`) {
    if (userLookupFails) return json({ msg: 'Fixture auth unavailable' }, 503);
    return json({ ...user, email: authoritativeEmail ?? user.email });
  }
  if (url.pathname === '/rest/v1/stripe_webhook_events') {
    if (method === 'GET') return json(events.get(url.searchParams.get('event_id')?.replace('eq.','')));
    if (method === 'POST') {
      if (events.has(body.event_id)) return json({ code: '23505' }, 409);
      events.set(body.event_id, { ...body, attempts: 1, received_at: new Date().toISOString() });
      return json([]);
    }
    const eventId = url.searchParams.get('event_id')?.replace('eq.','');
    Object.assign(events.get(eventId), body);
    return json(url.searchParams.has('select') ? { event_id: eventId } : []);
  }
  if (url.pathname === '/rest/v1/admin_notification_history') { notices.push(body); return json([]); }
  if (url.hostname === 'api.resend.com' && url.pathname === '/emails') {
    sends.push({ body, key: request.headers.get('idempotency-key') });
    return providerFails ? json({ name: 'application_error', message: 'Fixture provider unavailable' }, 500) : json({ id: 'mail-fixture' });
  }
  const protectedAuth = ['/auth/v1/signup','/auth/v1/recover','/auth/v1/resend','/auth/v1/otp'].includes(url.pathname) ||
    (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password');
  if (captchaEnforced && protectedAuth && body?.gotrue_meta_security?.captcha_token !== 'valid-fixture-token') {
    return json({ msg: 'CAPTCHA failed', code: 'captcha_failed' }, 400);
  }
  if (url.pathname === '/auth/v1/signup') return json({ user: { ...user }, session: null });
  if (url.pathname === '/auth/v1/verify') {
    if (body.token_hash === 'expired') return json({ msg: 'Expired', code: 'otp_expired' }, 403);
    return json(session());
  }
  if (url.pathname === '/auth/v1/token') return json(session());
  if (url.pathname === '/auth/v1/user') return json({ ...user });
  if (['/auth/v1/recover','/auth/v1/resend','/auth/v1/otp'].includes(url.pathname)) return json({});
  throw Error(`Unexpected registration fixture ${method} ${url.pathname}`);
};
const { default: app } = await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
const chunks = new URL('../.vercel/output/functions/_render.func/dist/server/chunks/', import.meta.url);
const name = readdirSync(chunks).find(name => name.startsWith('lead-notifications_') && name.endsWith('.mjs'));
assert.ok(name);
const module = await import(new URL(name, chunks));
const notify = Object.values(module).find(value => typeof value === 'function' && value.name === 'notifyLead');
assert.ok(notify);
const request = (path, body, cookie='') => app.fetch(new Request(base+path, {
  method: body ? 'POST' : 'GET', headers: { ...(body ? {origin:base,'content-type':'application/x-www-form-urlencoded'} : {}), ...(cookie ? {cookie} : {}) },
  body: body ? new URLSearchParams(body) : undefined,
}));
const registration = { email:user.email, password:'Fixture-Password-Only-123', password_confirmation:'Fixture-Password-Only-123', terms:'on',privacy:'on' };
let checks = 0;

let response = await request('/registro', registration);
assert.match(response.headers.get('location'), /sent=1/);
verifier = response.headers.getSetCookie().filter(value=>value.includes('-auth-token-code-verifier')).map(value=>value.split(';')[0]).join('; ');
assert.ok(verifier,'Capture the SDK-generated verifier cookie, including its actual storage key');
assert.equal(sends.length, 0); assert.equal(events.size, 0); checks++;
await notify({ kind:'registration', reference:id, email:user.email });
assert.equal(events.size, 0, 'An unconfirmed user cannot even claim a notification'); checks++;
await request('/auth/confirmar', { token_hash:'unconfirmed-fixture',type:'signup' });
assert.equal(sends.length, 0); checks++;
response=await request('/api/auth/callback?code=valid', undefined, `${verifier}; ${pending}`);
assert.equal(response.headers.get('location'),'/cuenta');
assert.equal(sends.length, 0); checks++;

user.email_confirmed_at = '2026-10-24T10:01:00Z';
await request('/auth/confirmar', { token_hash:'expired',type:'signup' });
assert.equal(sends.length, 0); checks++;
response = await request('/auth/confirmar', { token_hash:'valid-fixture',type:'signup' });
assert.equal(response.status,303); assert.equal(sends.length,1); assert.equal(notices.length,1);
assert.equal(sends[0].body.to, 'earlrititi@gmail.com'); assert.match(sends[0].body.text,/Correo confirmado en Supabase/); checks++;
await request('/auth/confirmar', { token_hash:'valid-fixture',type:'signup' });
await request('/auth/confirmar', { token_hash:'valid-fixture',type:'email' });
await request('/api/auth/callback?code=valid', undefined, `${verifier}; ${pending}`);
assert.equal(sends.length,1,'Confirmation routes share the original user-based deduplication key'); checks++;

events.clear(); sends.length=0; notices.length=0;
for (const type of ['magiclink','recovery','invite']) await request('/auth/confirmar',{token_hash:'valid-fixture',type});
response=await request('/api/auth/callback?code=valid',undefined,verifier);
assert.equal(response.headers.get('location'),'/cuenta');
await request('/login',{email:user.email,password:registration.password});
assert.equal(sends.length,0,'Ordinary historical logins and recovery must not trigger registration backfill'); checks++;
await request('/auth/confirmar',{token_hash:'valid-fixture',type:'email'});
assert.equal(sends.length,1,'The deployed type=email confirmation template works without a registration cookie'); checks++;
await request('/api/auth/callback?code=valid',undefined,`${verifier}; ${pending}`);
assert.equal(sends.length,1,'Confirmed PKCE registration shares deduplication with the email template'); checks++;

events.clear(); sends.length=0; notices.length=0;
response=await request('/api/auth/callback?code=valid',undefined,`${verifier}; ${pending}`);
assert.equal(response.headers.get('location'),'/cuenta');
assert.equal(sends.length,1,'A fresh confirmed PKCE registration sends the first notice without prior email confirmation');
assert.equal(notices.length,1); checks++;

events.clear(); sends.length=0;
authoritativeEmail = 'different@example.invalid';
await notify({kind:'registration',reference:id,email:user.email}); assert.equal(events.size,0); checks++;
authoritativeEmail=null; userLookupFails=true;
await assert.rejects(notify({kind:'registration',reference:id,email:user.email}),/AUTH_UNAVAILABLE/);
assert.equal(events.size,0); checks++; userLookupFails=false;
providerFails=true;
response=await request('/auth/confirmar',{token_hash:'valid-fixture',type:'signup'});
assert.equal(response.status,303,'Mail failure does not prevent successful confirmation');
assert.equal([...events.values()][0].status,'failed'); checks++;
providerFails=false;
await notify({kind:'registration',reference:id,email:user.email});
assert.equal([...events.values()][0].status,'completed');
assert.equal(sends[0].key,sends[1].key,'Provider retry preserves idempotency'); checks++;

process.env.AUTH_CAPTCHA_ENABLED='true'; process.env.PUBLIC_TURNSTILE_SITE_KEY='fixture-public-sitekey'; captchaEnforced=true;
const protectedForms=[['/registro',registration,'/auth/v1/signup'],['/login',{email:user.email,password:registration.password},'/auth/v1/token'],
  ['/login',{email:user.email,method:'magic'},'/auth/v1/otp'],['/recuperar-contrasena',{email:user.email},'/auth/v1/recover'],
  ['/confirmar-correo',{email:user.email},'/auth/v1/resend']];
for(const [path,body,endpoint] of protectedForms) {
  const html=await(await request(path)).text();
  assert.match(html,/class="cf-turnstile"/); assert.match(html,/challenges.cloudflare.com\/turnstile\/v0\/api.js/);
  let before=calls.length;
  response=await request(path,body);
  assert.match(response.headers.get('location'),/error=captcha/);
  assert.equal(calls.slice(before).some(call=>call.path===endpoint),false); checks++;
  response=await request(path,{...body,'cf-turnstile-response':'invalid-fixture-token'});
  assert.match(response.headers.get('location'),/error=captcha/); checks++;
  before=calls.length;
  response=await request(path,{...body,'cf-turnstile-response':'valid-fixture-token'});
  assert.doesNotMatch(response.headers.get('location'),/error=/);
  assert.equal(calls.slice(before).find(call=>call.path===endpoint)?.body.gotrue_meta_security.captcha_token,'valid-fixture-token'); checks++;
}
process.env.PUBLIC_TURNSTILE_SITE_KEY='';
response=await request('/registro',{...registration,'cf-turnstile-response':'valid-fixture-token'});
assert.match(response.headers.get('location'),/error=captcha/); checks++;
process.env.AUTH_CAPTCHA_ENABLED='false';
const html=await(await request('/registro')).text();assert.doesNotMatch(html,/class="cf-turnstile"|src="https:\/\/challenges.cloudflare.com/); checks++;
console.log(`${checks} registration notification and native CAPTCHA scenarios passed. No network, real accounts or emails.`);
