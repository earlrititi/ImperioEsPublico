import assert from 'node:assert/strict';

// Read-only checks of the published dashboard assets and its anonymous API guard.
const checks = [];
for (const host of ['imperioes.com', 'www.imperioes.com']) {
  for (const path of ['/', '/tienda', '/login', '/_astro/Analytics.DYU9jPdC.js']) {
    const response = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    if (path.endsWith('.js')) {
      const body = await response.text();
      assert.match(body, /Datos medidos por GA4/);
      assert.doesNotMatch(body, /GA4_SERVICE_ACCOUNT_JSON|BEGIN PRIVATE KEY|analyticsdata\.googleapis\.com/);
    } else await response.arrayBuffer();
    checks.push({ host, path, status: response.status });
  }
  const response = await fetch(`https://${host}/api/admin/analytics?days=30`);
  assert.equal(response.status, 403);
  checks.push({ host, path: '/api/admin/analytics', status: response.status });
}
console.log(JSON.stringify({ checks, serverSecretNotInClient: true }));
