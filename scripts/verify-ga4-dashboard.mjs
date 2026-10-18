import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { Socket } from 'node:net';

Socket.prototype.connect = () => { throw Error('External connections disabled in GA4 dashboard fixtures'); };
const env = parseEnv(readFileSync('.env.local', 'utf8'));
const project = new URL(env.PUBLIC_SUPABASE_URL).hostname.split('.')[0];
Object.assign(process.env, { PUBLIC_SITE_URL: 'https://imperioes.com', PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', RATE_LIMIT_SECRET: 'fixture-rate-limit',
  GA4_SERVICE_ACCOUNT_JSON: '' });
const user = { id: '24f42701-98e0-4716-810c-363ae1cc8fa2', email: 'fixture@example.invalid',
  email_confirmed_at: '2026-10-01T00:00:00Z',
  aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const expires = Math.floor(Date.now() / 1000) + 3600;
const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp:expires,role:'authenticated'})}.fixture`;
const cookie = `sb-${project}-auth-token=base64-${encode({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_at:expires,expires_in:3600,user})}`;
let forged = false, limited = false, localReads = 0;
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const path = new URL(request.url).pathname;
  if (path === '/auth/v1/user') return Response.json(forged ? {...user,id:'00000000-0000-4000-8000-000000000001',user_metadata:{role:'admin'}} : user);
  if (path === '/rest/v1/rpc/consume_rate_limit') return Response.json(!limited);
  if (path === '/rest/v1/rpc/admin_analytics_summary') {
    localReads++;
    return Response.json({interactions:[],consents:[],daily:[]});
  }
  throw Error(`Unexpected fixture request: ${path}`);
};
const { default: app } = await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
const get = (authenticated = true, suffix = '') => app.fetch(new Request(`https://imperioes.com/api/admin/analytics${suffix}`,
  {headers:authenticated?{cookie}:{}}));
assert.equal((await get(false)).status,403);
forged = true; assert.equal((await get()).status,403); forged = false;
assert.equal(localReads,0);
assert.equal((await get(true,'?days=999')).status,400);
assert.equal(localReads,0);
for (const days of [7,30,90,365]) {
  const response = await get(true,`?days=${days}`);
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/\bno-store\b/);
  const result = await response.json();
  assert.equal(result.ga4.status,'not_configured');
  assert.equal(result.ga4.measuredOnly,true);
  assert.deepEqual(result.daily,[]);
}
process.env.GA4_SERVICE_ACCOUNT_JSON = '{invalid fixture JSON';
const unavailable = await (await get()).json();
assert.equal(unavailable.ga4.status,'unavailable');
assert.doesNotMatch(JSON.stringify(unavailable),/invalid fixture JSON|private_key|refresh_token/);
limited = true;
assert.equal((await get()).status,429);
const assets = '.vercel/output/static/_astro';
for (const name of readdirSync(assets).filter(name=>name.endsWith('.js'))) {
  assert.doesNotMatch(readFileSync(`${assets}/${name}`,'utf8'),/GA4_SERVICE_ACCOUNT_JSON|BEGIN PRIVATE KEY|analyticsdata\.googleapis\.com/,
    `Server-only Analytics material must not enter client asset ${name}`);
}
console.log('GA4 dashboard: admin identity, forged roles, private caching, periods, rate limit, missing/invalid credentials and server-only bundle isolation passed. No Google requests or real secrets.');
