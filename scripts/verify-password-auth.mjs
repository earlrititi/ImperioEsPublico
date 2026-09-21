import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const env = parseEnv(readFileSync('.env.local', 'utf8'));
process.env.PUBLIC_SITE_URL = 'https://imperioes.com';
process.env.PUBLIC_SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
process.env.PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service';
process.env.RATE_LIMIT_SECRET = 'fixture-rate-limit-secret-long-enough';
const user = { id:'00000000-0000-4000-8000-000000000011', email:'fixture@example.invalid', email_confirmed_at:'2026-09-15T00:00:00Z', aud:'authenticated', role:'authenticated', app_metadata:{}, user_metadata:{} };
const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const exp = Math.floor(Date.now()/1000)+3600;
const token = `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,exp,role:'authenticated'})}.fixture`;
const session = { access_token:token, refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user };
const project = new URL(env.PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const cookie = `sb-${project}-auth-token=base64-${encode(session)}`;
let allowed = true, denyPassword = false, denyCode = false, updateFail = false;
const calls = [];
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = options.method || (input instanceof Request ? input.method : 'GET');
  const body = options.body ? JSON.parse(options.body) : {};
  calls.push({path:url.pathname,method,body});
  const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if (url.pathname === '/rest/v1/rpc/consume_rate_limit') return json(allowed);
  if (url.pathname === '/rest/v1/legal_consents') return json([]);
  if (url.pathname === '/auth/v1/token') {
    if ((url.searchParams.get('grant_type')==='password' && denyPassword) || denyCode) return json({msg:'Invalid credentials',error_code:'invalid_credentials'},400);
    return json(session);
  }
  if (url.pathname === '/auth/v1/signup') return json({user:{...user,email_confirmed_at:null},session:null});
  if (url.pathname === '/auth/v1/user') return updateFail && method==='PUT' ? json({msg:'Invalid password'},422) : json(user);
  if (['/auth/v1/recover','/auth/v1/resend','/auth/v1/otp','/auth/v1/logout'].includes(url.pathname)) return json({});
  throw Error(`Unexpected fixture request ${url.pathname}`);
};
const { default:app } = await import('../.vercel/output/functions/_render.func/dist/server/entry.mjs');
const base = 'https://imperioes.com';
async function request(path, body, cookies='', origin=base) {
  return app.fetch(new Request(base+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/x-www-form-urlencoded',origin}:{}),...(cookies?{cookie:cookies}:{})},body:body?new URLSearchParams(body):undefined}));
}
let checks=0;
for(const path of ['/login','/registro','/recuperar-contrasena','/confirmar-correo']) {
  const r=await request(path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');checks++;
}
const credentials={email:user.email,password:'Test-Only-Password-123!'};
let r=await request('/login',credentials);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/cuenta');assert.ok(r.headers.get('set-cookie'));checks++;
denyPassword=true;r=await request('/login',credentials);assert.match(r.headers.get('location'),/credentials/);denyPassword=false;checks++;
r=await request('/login?next=https://evil.invalid',credentials);assert.equal(r.headers.get('location'),'/cuenta');checks++;
let before=calls.length;r=await request('/login',credentials,'','https://evil.invalid');assert.ok(r.status===403 || r.headers.get('location')?.includes('origin'));assert.equal(calls.length,before);checks++;
allowed=false;r=await request('/login',credentials);assert.match(r.headers.get('location'),/rate/);allowed=true;checks++;
r=await request('/registro',{...credentials,password_confirmation:'different',terms:'on',privacy:'on'});assert.match(r.headers.get('location'),/password/);checks++;
r=await request('/registro',{...credentials,password_confirmation:credentials.password});assert.match(r.headers.get('location'),/validation/);checks++;
r=await request('/registro',{...credentials,password_confirmation:credentials.password,terms:'on',privacy:'on'});assert.match(r.headers.get('location'),/sent=1/);assert.equal(calls.find(c=>c.path==='/auth/v1/signup').body.password,credentials.password);checks++;
r=await request('/recuperar-contrasena',{email:user.email});assert.equal(r.headers.get('location'),'/recuperar-contrasena?sent=1');assert.ok(calls.some(c=>c.path==='/auth/v1/recover'));checks++;
r=await request('/confirmar-correo',{email:user.email});assert.equal(r.headers.get('location'),'/confirmar-correo?sent=1');checks++;
r=await request('/cuenta/contrasena');assert.match(r.headers.get('location'),/^\/login/);checks++;
r=await request('/cuenta/contrasena',{password:'short',password_confirmation:'short'},cookie);assert.match(await r.text(),/deben coincidir/);checks++;
before=calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT').length;
r=await request('/cuenta/contrasena',{password:credentials.password,password_confirmation:credentials.password},cookie,'https://evil.invalid');assert.equal(calls.filter(c=>c.path==='/auth/v1/user'&&c.method==='PUT').length,before);checks++;
r=await request('/cuenta/contrasena',{password:credentials.password,password_confirmation:credentials.password},cookie);assert.equal(r.headers.get('location'),'/login?updated=1');assert.ok(calls.some(c=>c.path==='/auth/v1/logout'));checks++;
r=await request('/api/auth/callback');assert.match(r.headers.get('location'),/missing_code/);checks++;
denyCode=true;r=await request('/api/auth/callback?code=expired');assert.match(r.headers.get('location'),/auth_callback/);denyCode=false;checks++;
r=await request('/api/auth/callback?code=valid&next=%2Fcuenta%2Fcontrasena',undefined,`sb-${project}-auth-token-code-verifier=base64-${encode('fixture-verifier')}`);assert.equal(r.headers.get('location'),'/cuenta/contrasena');checks++;
r=await request('/api/auth/logout',{logout:'1'},cookie,'https://evil.invalid');assert.equal(r.status,403);checks++;
r=await request('/api/auth/logout',{logout:'1'},cookie);assert.equal(r.status,303);checks++;
console.log(`${checks} compiled password authentication scenarios passed. No network or real emails.`);
