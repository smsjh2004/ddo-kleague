import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createSessionController } from '../utils/sessionLifecycle.js';

const key = 'test-auth';
const user = { id: 'test-user', aud: 'authenticated', role: 'authenticated', user_metadata: {} };
function makeSession(seconds) {
  const expires_at = Math.floor(Date.now() / 1000) + seconds;
  const payload = Buffer.from(JSON.stringify({ sub: user.id, aud: user.aud, exp: expires_at })).toString('base64url');
  return { user, access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: 'saved-refresh', expires_at, token_type: 'bearer' };
}
function memoryStorage(initial) {
  const values = new Map([[key, JSON.stringify(initial)]]);
  return { getItem: async (key) => values.get(key) || null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async (key) => { values.delete(key); } };
}
function client(storage, fetch) {
  return createClient('https://test-project.supabase.co', 'test-anon-key', {
    auth: { storageKey: key, storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch },
  });
}

test('real SDK restores a saved session on consecutive application launches', async () => {
  const storage = memoryStorage(makeSession(3600));
  let networkCalls = 0;
  for (let launch = 0; launch < 2; launch++) {
    const supabase = client(storage, async () => { networkCalls++; throw new Error('Unexpected request'); });
    const controller = createSessionController({ auth: supabase.auth, loadProfile: async (id) => ({ id }), timeoutMs: 500 });
    await controller.start();
    for (let i = 0; i < 20 && controller.getState().status !== 'ready'; i++) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(controller.getState().status, 'ready');
    assert.equal(controller.getState().profile.id, user.id);
    controller.stop();
    await supabase.auth.dispose();
  }
  assert.equal(networkCalls, 0);
});

test('real SDK rotates an expired token and persists it for the next launch', async () => {
  const storage = memoryStorage(makeSession(-60));
  let refreshes = 0;
  const supabase = client(storage, async (url, options) => {
    assert.match(String(url), /token\?grant_type=refresh_token/);
    assert.equal(JSON.parse(options.body).refresh_token, 'saved-refresh');
    refreshes++;
    return new Response(JSON.stringify({ ...makeSession(3600), expires_in: 3600, refresh_token: 'rotated-refresh' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const controller = createSessionController({ auth: supabase.auth, loadProfile: async (id) => ({ id }), timeoutMs: 500 });
  await controller.start();
  for (let i = 0; i < 20 && controller.getState().status !== 'ready'; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(controller.getState().status, 'ready');
  assert.equal(refreshes, 1);
  assert.equal(JSON.parse(await storage.getItem(key)).refresh_token, 'rotated-refresh');
  controller.stop();
  await supabase.auth.dispose();
});

test('real SDK invalid refresh token returns to signed-out state instead of an endless spinner', async () => {
  const storage = memoryStorage(makeSession(-60));
  const supabase = client(storage, async () => new Response(JSON.stringify({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
  const controller = createSessionController({ auth: supabase.auth, loadProfile: async () => { throw new Error('Must not query signed-out data'); }, timeoutMs: 500 });
  await controller.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(controller.getState().status, 'signedOut');
  assert.equal(await storage.getItem(key), null);
  controller.stop();
  await supabase.auth.dispose();
});
