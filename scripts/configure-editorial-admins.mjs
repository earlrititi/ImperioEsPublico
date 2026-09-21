import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(readFileSync('.env.reservation-production.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://pjrqozlyrjgugdraoght.supabase.co');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const emails = ['earlrititi@gmail.com', 'imperio_e@hotmail.com'];
const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
  assert.ifError(error);
  users.push(...data.users);
  if (data.users.length < 100) break;
}
for (const email of emails) {
  let user = users.find(u => u.email?.toLowerCase() === email);
  if (process.argv.includes('--apply')) {
    const result = user
      ? await db.auth.admin.updateUserById(user.id, {
          email_confirm: true,
          app_metadata: { ...user.app_metadata, editorial_admin: true },
        })
      : await db.auth.admin.createUser({
          email,
          email_confirm: true,
          app_metadata: { editorial_admin: true },
        });
    assert.ifError(result.error);
    user = result.data.user;
    assert.equal(user.app_metadata.editorial_admin, true);
    assert.ok(user.email_confirmed_at);
  }
  console.log(JSON.stringify({ email, exists: Boolean(user), confirmed: Boolean(user?.email_confirmed_at), editorialAccessAssigned: user?.app_metadata?.editorial_admin === true }));
}
