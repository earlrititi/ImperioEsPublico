import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseArgs, parseEnv } from 'node:util';
import Stripe from 'stripe';

const { values } = parseArgs({ options: {
  apply: { type: 'boolean', default: false },
  'vercel-cli': { type: 'string' },
} });
const accountId = 'acct_1UCc4cDRITvLIOKF';
const projectId = 'prj_sGnSgdWDmz3kzD8yHidTtA1US8DH';
const teamId = 'team_hQezVofPx29szeDrLNPRsFhI';
const localPath = '.env.stripe-live.local';
const catalogPath = `.env.stripe-live.${accountId}.local`;
const expected = [
  ['STRIPE_PRICE_ARCABUCERO_MONTHLY', 199, 'month'],
  ['STRIPE_PRICE_ARCABUCERO_ANNUAL', 1799, 'year'],
  ['STRIPE_PRICE_MAESTRE_CAMPO_MONTHLY', 399, 'month'],
  ['STRIPE_PRICE_MAESTRE_CAMPO_ANNUAL', 3799, 'year'],
  ['STRIPE_PRICE_CAMISETA_IMPERIAL', 2699, null],
];

function api(path, method = 'GET', body) {
  const args = [values['vercel-cli'], 'api', `${path}?teamId=${teamId}`, '--raw', '-X', method];
  if (body) args.push('--input', '-');
  const result = spawnSync(process.execPath, args, {
    input: body ? JSON.stringify(body) : undefined,
    encoding: 'utf8', timeout: 60000, windowsHide: true,
  });
  // API responses and CLI diagnostics can contain credentials; never log them.
  if (result.status !== 0) throw new Error(`VERCEL_${method}_FAILED`);
  const data = result.stdout.trim() ? JSON.parse(result.stdout) : {};
  if (data.error || data.errors?.length) throw new Error(`VERCEL_${method}_REJECTED`);
  return data;
}

async function main() {
  const local = parseEnv(fs.readFileSync(localPath, 'utf8'));
  const catalog = parseEnv(fs.readFileSync(catalogPath, 'utf8'));
  assert(/^(sk|rk)_live_/.test(local.STRIPE_SECRET_KEY || ''), 'LIVE_KEY_REQUIRED');
  assert.equal(catalog.STRIPE_ACCOUNT_ID, accountId, 'CATALOG_ACCOUNT_MISMATCH');
  assert(/^whsec_/.test(catalog.STRIPE_WEBHOOK_SECRET || ''), 'WEBHOOK_SECRET_REQUIRED');
  const stripe = new Stripe(local.STRIPE_SECRET_KEY, { apiVersion: '2026-07-29.dahlia' });
  const account = await stripe.accounts.retrieve();
  assert.equal(account.id, accountId, 'STRIPE_ACCOUNT_MISMATCH');
  assert(account.charges_enabled && account.payouts_enabled, 'ACCOUNT_NOT_ENABLED');
  const env = { STRIPE_SECRET_KEY: local.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: catalog.STRIPE_WEBHOOK_SECRET };
  for (const [key, amount, interval] of expected) {
    const price = await stripe.prices.retrieve(catalog[key]);
    assert(price.active && price.livemode && price.currency === 'eur', 'PRICE_NOT_LIVE');
    assert.equal(price.unit_amount, amount, 'PRICE_AMOUNT_MISMATCH');
    assert.equal(price.recurring?.interval ?? null, interval, 'PRICE_INTERVAL_MISMATCH');
    env[key] = price.id;
  }
  const hook = await stripe.webhookEndpoints.retrieve('we_1UCez1DRITvLIOKFFoxwXWnQ');
  assert(hook.livemode && hook.status === 'enabled', 'WEBHOOK_NOT_ENABLED');
  assert.equal(hook.url, 'https://imperioes.com/api/stripe-webhook', 'WEBHOOK_URL_MISMATCH');
  console.log('Validated Live account, five prices and webhook.');
  if (!values.apply) return;
  assert(values['vercel-cli'], 'VERCEL_CLI_PATH_REQUIRED');
  const linked = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
  assert(linked.projectId === projectId && linked.orgId === teamId, 'VERCEL_PROJECT_MISMATCH');
  const before = api(`/v9/projects/${projectId}/env`).envs;
  assert(Array.isArray(before), 'VERCEL_ENV_LIST_INVALID');
  for (const [key, value] of Object.entries(env)) {
    const matches = before.filter(e => e.key === key && e.target?.includes('production') && !e.gitBranch);
    assert(matches.length <= 1, 'AMBIGUOUS_PRODUCTION_ENV');
    const existing = matches[0];
    const remainingTargets = existing?.target.filter(t => t !== 'production') || [];
    if (existing && (remainingTargets.length || existing.customEnvironmentIds?.length)) {
      // Move the old record to its non-production targets without reading its secret.
      api(`/v10/projects/${projectId}/env/${existing.id}`, 'PATCH', { target: remainingTargets });
      try {
        api(`/v10/projects/${projectId}/env`, 'POST', { key, value, type: 'sensitive', target: ['production'] });
      } catch (error) {
        api(`/v10/projects/${projectId}/env/${existing.id}`, 'PATCH', { target: existing.target });
        throw error;
      }
    } else if (existing) {
      api(`/v10/projects/${projectId}/env/${existing.id}`, 'PATCH', {
        value, type: 'sensitive', target: ['production'],
      });
    } else {
      api(`/v10/projects/${projectId}/env`, 'POST', { key, value, type: 'sensitive', target: ['production'] });
    }
    console.log(`${key}: Production configured`);
  }
  const after = api(`/v9/projects/${projectId}/env`).envs;
  for (const key of Object.keys(env)) {
    const live = after.filter(e => e.key === key && e.target?.includes('production'));
    assert(live.length === 1 && live[0].target.length === 1 && live[0].type === 'sensitive', 'LIVE_ENV_NOT_ISOLATED');
    for (const old of before.filter(e => e.key === key && e.target?.includes('preview'))) {
      const preview = after.find(e => e.id === old.id);
      assert(preview?.target.includes('preview') && !preview.target.includes('production'), 'PREVIEW_TARGET_CHANGED');
      assert.equal(preview.value, old.value, 'PREVIEW_VALUE_CHANGED');
    }
  }
  // Mechanically replace the obsolete catalog values, preserving the user's key.
  const merged = { ...local, ...env, STRIPE_ACCOUNT_ID: accountId };
  fs.writeFileSync(localPath, '# Stripe Live for acct_1UCc4cDRITvLIOKF. Not loaded automatically.\n'
    + Object.entries(merged).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n');
  console.log('Production isolated; Preview preserved; local Live file synchronized. No deployment performed.');
}

main().catch(error => {
  console.error('Stripe Live setup stopped:', error.code || error.type || 'VALIDATION_OR_API_ERROR');
  process.exitCode = 1;
});
