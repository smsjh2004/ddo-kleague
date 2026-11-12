import test from 'node:test';
import assert from 'node:assert/strict';
import * as flow from '../utils/oauthFlow.js';
const scenario = test;
const url = 'kleaguediary://auth-callback#access_token=access&refresh_token=refresh';

scenario('duplicate delivery from Linking and the auth browser installs a session only once', async () => {
  let calls = 0;
  const session = { user: { id: 'a' }, access_token: 'access' };
  const auth = {
    getSession: async () => ({ data: { session: null } }),
    setSession: async () => { calls++; return { data: { session } }; },
  };
  const consume = flow.createCallbackConsumer(() => auth);
  const results = await Promise.all([consume(url), consume(url), consume(url)]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result === session));
  await consume(url);
  assert.equal(calls, 1);
});

scenario('callback recognition rejects unrelated URLs and incomplete tokens', async () => {
  let calls = 0;
  const auth = { setSession: async () => { calls++; } };
  const consume = flow.createCallbackConsumer(() => auth);
  assert.equal(await consume('https://example.test/auth-callback#access_token=x&refresh_token=y'), null);
  assert.equal(await consume('kleaguediary://auth-callback#access_token=only'), null);
  assert.equal(calls, 0);
});

scenario('an already-installed callback does not rotate the session again', async () => {
  let calls = 0;
  const session = { access_token: 'access', refresh_token: 'refresh' };
  const consume = flow.createCallbackConsumer(() => ({
    getSession: async () => ({ data: { session } }),
    setSession: async () => { calls++; },
  }));
  assert.equal(await consume(url), session);
  assert.equal(calls, 0);
});

scenario('PKCE callback exchanges the code once', async () => {
  let calls = 0;
  const auth = { exchangeCodeForSession: async (code) => { calls++; assert.equal(code, 'abc'); return { data: { session: { user: { id: 'a' } } } }; } };
  const consume = flow.createCallbackConsumer(() => auth);
  await consume('kleaguediary://auth-callback?code=abc');
  assert.equal(calls, 1);
});

function nativeHarness() {
  const links = new Set();
  const states = new Set();
  return {
    linking: { addEventListener(_name, fn) { links.add(fn); return { remove: () => links.delete(fn) }; } },
    appState: { currentState: 'active', addEventListener(_name, fn) { states.add(fn); return { remove: () => states.delete(fn) }; } },
    emit: (value) => links.forEach((fn) => fn({ url: value })),
    subscriptions: () => links.size + states.size,
  };
}

scenario('native browser that never resolves times out and releases every listener', async () => {
  const harness = nativeHarness();
  await assert.rejects(flow.waitForNativeRedirect({ ...harness, openBrowser: () => new Promise(() => {}), timeoutMs: 20 }), { code: 'TIMEOUT' });
  assert.equal(harness.subscriptions(), 0);
});

scenario('Android dismiss followed by a delayed deep link succeeds', async () => {
  const harness = nativeHarness();
  const pending = flow.waitForNativeRedirect({ ...harness, openBrowser: async () => ({ type: 'dismiss' }), graceMs: 40, timeoutMs: 100 });
  setTimeout(() => harness.emit(url), 5);
  assert.equal(await pending, url);
  assert.equal(harness.subscriptions(), 0);
});

scenario('a genuine browser cancellation settles and cleans up', async () => {
  const harness = nativeHarness();
  const result = await flow.waitForNativeRedirect({ ...harness, openBrowser: async () => ({ type: 'cancel' }), graceMs: 5, timeoutMs: 50 });
  assert.equal(result, null);
  assert.equal(harness.subscriptions(), 0);
});

scenario('native refresh follows foreground/background and cleans up on unmount', () => {
  const calls = [];
  let listener;
  const auth = { startAutoRefresh: () => calls.push('start'), stopAutoRefresh: () => calls.push('stop') };
  const appState = { currentState: 'active', addEventListener(_name, fn) { listener = fn; return { remove: () => { listener = null; } }; } };
  const cleanup = flow.bindNativeAutoRefresh(auth, appState, false);
  listener('background');
  listener('active');
  cleanup();
  assert.deepEqual(calls, ['start', 'stop', 'start', 'stop']);
  assert.equal(listener, null);
  calls.length = 0;
  flow.bindNativeAutoRefresh(auth, appState, true)();
  assert.deepEqual(calls, []);
});
