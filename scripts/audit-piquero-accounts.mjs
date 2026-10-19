import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const env = parseEnv(readFileSync('.env.reservation-production.local', 'utf8'));
assert.equal(env.PUBLIC_SUPABASE_URL, 'https://pjrqozlyrjgugdraoght.supabase.co');
const db = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = [];
for (let page = 1; page <= 100; page++) {
  const result = await db.auth.admin.listUsers({ page, perPage: 1000 });
  assert.ifError(result.error); users.push(...result.data.users);
  if (result.data.users.length < 1000) break;
  assert.ok(page < 100, 'Review audit pagination limit');
}
const profiles = await db.from('profiles').select('id,email,full_name,free_plan,created_at').order('created_at').limit(10001);
assert.ifError(profiles.error); assert.ok(profiles.data.length < 10001);
const byId = new Map(users.map(user => [user.id, user]));
const now = Date.now(), buckets = new Map(), domains = new Map();
for (const user of users) {
  const bucket = Math.floor(Date.parse(user.created_at) / 600000);
  buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
}
const accounts = profiles.data.filter(profile => profile.free_plan === 'piquero').map(profile => {
  const user = byId.get(profile.id), email = String(user?.email || profile.email || '').toLowerCase();
  const name = String(profile.full_name || user?.user_metadata?.full_name || '');
  const reasons = [];
  if (!user) reasons.push('PROFILE_WITHOUT_AUTH_USER');
  if (user && !user.email_confirmed_at && !user.last_sign_in_at && now - Date.parse(user.created_at) > 7 * 86400000) reasons.push('UNCONFIRMED_INACTIVE_OVER_7_DAYS');
  if (name && /https?:\/\/|<\/?[a-z][\s\S]*>/i.test(name)) reasons.push('NAME_CONTAINS_URL_OR_MARKUP');
  const bucket = user ? Math.floor(Date.parse(user.created_at) / 600000) : null;
  if (bucket !== null && buckets.get(bucket) >= 10) reasons.push('TEN_OR_MORE_REGISTRATIONS_IN_TEN_MINUTES');
  const domain = email.split('@')[1] || 'missing'; domains.set(domain, (domains.get(domain) ?? 0) + 1);
  return { id: profile.id, email, name, confirmed: Boolean(user?.email_confirmed_at), lastSignIn: user?.last_sign_in_at ?? null,
    createdAt: user?.created_at ?? profile.created_at, reasons };
});
const summary = { checkedAt: new Date().toISOString(), readOnly: true, authUsers: users.length, piqueroProfiles: accounts.length,
  confirmed: accounts.filter(row => row.confirmed).length, unconfirmed: accounts.filter(row => !row.confirmed).length,
  signedIn: accounts.filter(row => row.lastSignIn).length, requiresReview: accounts.filter(row => row.reasons.length).length,
  reasons: Object.fromEntries([...new Set(accounts.flatMap(row => row.reasons))].map(reason => [reason, accounts.filter(row => row.reasons.includes(reason)).length])),
  domains: [...domains].map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count).slice(0, 20),
  actionsTaken: [], limits: ['Heuristic review only; none of these signals proves an account is a bot.',
    'Unconfirmed email can reflect delivery trouble, not abuse.', 'No IP, device fingerprint, CAPTCHA verdict or external Auth logs inspected.',
    'free_plan=piquero is a profile field, not evidence about paid subscription status.'] };
mkdirSync('tmp/commercial-audit', { recursive: true });
const path = 'tmp/commercial-audit/piquero-review-2026-10-17.json';
writeFileSync(path, JSON.stringify({ ...summary, accounts }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ path, ...summary }));
