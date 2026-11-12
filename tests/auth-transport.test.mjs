import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimedFetch } from '../utils/async.js';

test('successful fetch keeps the response body readable', async () => {
  let signal;
  const fetch = createTimedFetch(async (_url, options) => {
    signal = options.signal;
    return new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
  });
  const response = await fetch('https://example.test');
  assert.equal(signal.aborted, false);
  assert.deepEqual(await response.json(), { ok: true });
});

test('stalled fetch rejects and aborts the underlying request', async () => {
  let signal;
  const fetch = createTimedFetch((_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  }, undefined, 15);
  await assert.rejects(fetch('https://example.test'), { code: 'TIMEOUT' });
  assert.equal(signal.aborted, true);
});

test('caller cancellation reaches the network request', async () => {
  const controller = new AbortController();
  let signal;
  const fetch = createTimedFetch((_url, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const request = fetch('https://example.test', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /aborted/);
  assert.equal(signal.aborted, true);
});
