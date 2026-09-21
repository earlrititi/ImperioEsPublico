import test from 'node:test';
import assert from 'node:assert/strict';
import { validEmail, validNewPassword, readAuthForm, privateAuthHeaders } from '../src/lib/auth-forms';
test('Password policy preserves spaces and checks UTF-8 length', () => {
  assert.equal(validNewPassword('short'), false);
  assert.equal(validNewPassword('a'.repeat(12)), true);
  assert.equal(validNewPassword('a'.repeat(73)), false);
  assert.equal(validNewPassword('🙂'.repeat(19)), false);
  assert.equal(validNewPassword('A long pass phrase '), true);
});
test('Email validation rejects malformed input', () => {
  assert.equal(validEmail('user@example.com'), true);
  assert.equal(validEmail('user@example.com\n'), false);
  assert.equal(validEmail('not-email'), false);
});
test('Authentication POST rejects foreign or missing Origin before accessing services', async () => {
  for (const origin of ['', 'null', 'https://evil.invalid']) {
    const request = new Request('https://imperioes.com/login', { method:'POST', headers:{origin}, body:'email=user@example.com' });
    await assert.rejects(readAuthForm(request, 'test'), /origin/);
  }
});
test('Private auth pages preserve same-origin native form submissions without external referrers', () => {
  const headers = new Headers();
  privateAuthHeaders(headers);
  assert.equal(headers.get('Referrer-Policy'), 'same-origin');
  assert.equal(headers.get('Cache-Control'), 'private, no-store');
});
