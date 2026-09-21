import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createServer } from 'node:net';
import Stripe from 'stripe';

const saved = parseEnv(readFileSync('.env.reservation-test.local', 'utf8'));
assert.equal(saved.PUBLIC_SUPABASE_URL, 'https://joicpkgvggfxzrdazisx.supabase.co');
assert.equal(saved.RESERVATION_MODE, 'true');
assert.equal(saved.STRIPE_LIVE_CHECKOUT_ENABLED, 'false');
assert.match(saved.STRIPE_SECRET_KEY, /^(sk|rk)_test_/);
const stripe = new Stripe(saved.STRIPE_SECRET_KEY);
assert.equal((await stripe.accounts.retrieve()).id, 'acct_1UCc4cDRITvLIOKF');
const port = 4325;
const probe = createServer();
await new Promise((resolve, reject) => probe.once('error', reject).listen(port, '127.0.0.1', resolve));
await new Promise((resolve) => probe.close(resolve));
const cli = join(process.env.LOCALAPPDATA, 'ImperioETools/stripe/stripe.exe');
const env = {
  ...process.env, ...saved,
  STRIPE_API_KEY: saved.STRIPE_SECRET_KEY,
  PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
  RESERVATION_MODE: process.argv.includes('--reservations') ? 'true' : 'false', SHIRT_SALES_APPROVED: 'true',
  STRIPE_LIVE_CHECKOUT_ENABLED: 'false', COMMERCE_EMAIL_MODE: 'disabled',
  ASTRO_DEV_BACKGROUND: '1',
};
const events = 'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded';
// Capture the signing secret in memory; never print it or write it to source files.
try {
  env.STRIPE_WEBHOOK_SECRET = execFileSync(cli, ['listen', '--print-secret'], {
    env, encoding: 'utf8', windowsHide: true, timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch { throw new Error('Could not obtain the Test listener secret'); }
assert.match(env.STRIPE_WEBHOOK_SECRET, /^whsec_\S+$/);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    try { execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
  process.exit(code);
}
function start(command, args) {
  const child = spawn(command, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    const redact = (text) => text.replace(/(?:whsec_|[sr]k_(?:test|live)_)[A-Za-z0-9_]+/g, '[REDACTED]');
    stream.on('data', (chunk) => {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) process.stdout.write(redact(line) + '\n');
    });
    stream.on('end', () => { if (pending) process.stdout.write(redact(pending)); });
  }
  child.on('error', () => { console.error('Test child process failed'); stop(1); });
  child.on('exit', () => { if (!stopping) stop(1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.stdin.resume();
process.stdin.on('data', (data) => { if (data.toString().trim() === 'q') stop(); });
start(cli, ['listen', '--events', events, '--forward-to', `${env.PUBLIC_SITE_URL}/api/stripe-webhook`]);
start(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', String(port), '--mode', 'reservation-test']);
console.log(`Isolated payment Test: ${env.PUBLIC_SITE_URL}; type q to stop. No saved environment changes.`);
