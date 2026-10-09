import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
const e=parseEnv(readFileSync('.env.reservation-production.local','utf8'));
assert.equal(e.PUBLIC_SUPABASE_URL,'https://pjrqozlyrjgugdraoght.supabase.co');
const notices=JSON.parse(readFileSync('.env.admin-notice-import.local.json','utf8'));
const rows=notices.map(n=>{
  assert.match(n.id,/^[a-f0-9]+$/);assert.match(n.customer_email,/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.ok(['registration','checkout_interest'].includes(n.kind));assert.ok(Number.isFinite(Date.parse(n.received_at)));
  assert.ok(n.url.startsWith('https://mail.google.com/'));
  return {id:`gmail_${n.id}`,kind:n.kind,customer_email:n.customer_email,subject:n.subject,occurred_at:n.received_at,source:'gmail',delivery_status:'received_in_owner_inbox',source_url:n.url};
});
console.log(JSON.stringify({notices:rows.length,freeRegistrations:rows.filter(n=>n.kind==='registration').length,unpaidInterests:rows.filter(n=>n.kind==='checkout_interest').length}));
if(process.argv.includes('--apply')){
  const db=createClient(e.PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from('admin_notification_history').upsert(rows,{onConflict:'id'});assert.ifError(error);
  console.log('Owner notice history imported idempotently. No accounts, entitlements or marketing consent created.');
}
process.exit(0);
