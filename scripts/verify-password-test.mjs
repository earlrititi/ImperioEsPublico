import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const env=parseEnv(readFileSync('.env.reservation-test.local','utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL,'https://joicpkgvggfxzrdazisx.supabase.co');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,options);
const anon=createClient(env.PUBLIC_SUPABASE_URL,env.PUBLIC_SUPABASE_ANON_KEY,options);
const email=`auth-${randomUUID()}@example.invalid`;
const password=`Test-${randomBytes(20).toString('hex')}`;
const nextPassword=`Changed-${randomBytes(20).toString('hex')}`;
const base='http://127.0.0.1:4325';
let id;
async function post(path,body,cookie='') {
  return fetch(base+path,{method:'POST',redirect:'manual',headers:{origin:base,'content-type':'application/x-www-form-urlencoded',cookie},body:new URLSearchParams(body)});
}
try {
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);id=created.data.user.id;
  const signed=await post('/login',{email,password});assert.equal(signed.status,303);assert.equal(signed.headers.get('location'),'/cuenta');
  const cookies=signed.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookies);
  const form=await fetch(base+'/cuenta/contrasena',{headers:{cookie:cookies}});assert.equal(form.status,200);
  const denied=await post('/login',{email,password:'Wrong-password-123!'});assert.match(denied.headers.get('location'),/credentials/);
  const link=await admin.auth.admin.generateLink({type:'recovery',email});assert.ifError(link.error);
  const recovery=await anon.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'recovery'});assert.ifError(recovery.error);
  const session=recovery.data.session;assert.ok(session);
  const encoded=Buffer.from(JSON.stringify(session)).toString('base64url');
  const recoveryCookie=`sb-joicpkgvggfxzrdazisx-auth-token=base64-${encoded}`;
  const changed=await post('/cuenta/contrasena',{password:nextPassword,password_confirmation:nextPassword},recoveryCookie);
  assert.equal(changed.headers.get('location'),'/login?updated=1');
  const old=await anon.auth.signInWithPassword({email,password});assert.ok(old.error);
  const fresh=await post('/login',{email,password:nextPassword});assert.equal(fresh.headers.get('location'),'/cuenta');
  const reused=await anon.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'recovery'});assert.ok(reused.error);
  const user=await admin.auth.admin.getUserById(id);assert.ifError(user.error);assert.notEqual(user.data.user.app_metadata.editorial_admin,true);
  console.log('Test Supabase: password login, invalid password, protected form, recovery token, password update, old password rejection and token single-use verified. No emails sent.');
} finally {
  if(id){const removed=await admin.auth.admin.deleteUser(id);assert.ifError(removed.error);console.log('Synthetic Test account deleted.');}
}
