import test from 'node:test';
import assert from 'node:assert/strict';

import * as lifecycle from '../utils/sessionLifecycle.js';

const session = (id = 'user-a', token = 'token-a') => ({ user: { id }, access_token: token });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
async function until(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) await tick();
  assert.ok(predicate(), 'The session should reach a terminal state');
}

function setup(overrides = {}) {
  let listener;
  let profileCalls = 0;
  let inAuthCallback = false;
  const auth = {
    getSession: async () => ({ data: { session: session() }, error: null }),
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { listener = null; } } } };
    },
    ...overrides.auth,
  };
  const controller = lifecycle.createSessionController({
    auth,
    timeoutMs: 25,
    loadProfile: async (id) => {
      assert.equal(inAuthCallback, false, 'Queries must run outside auth notification callbacks');
      profileCalls++;
      return { id, nickname: id };
    },
    ...overrides,
    auth,
  });
  return {
    controller,
    profileCalls: () => profileCalls,
    emit(event, value) { inAuthCallback = true; listener?.(event, value); inAuthCallback = false; },
  };
}

const scenario = test;

scenario('a stalled persisted session leaves loading and can retry without clearing storage', async () => {
  let stalled = true;
  const { controller } = setup({ auth: { getSession: () => stalled ? new Promise(() => {}) : Promise.resolve({ data: { session: session() }, error: null }) } });
  await controller.start();
  assert.equal(controller.getState().status, 'error');
  stalled = false;
  await controller.retry();
  assert.equal(controller.getState().status, 'ready');
  controller.stop();
});

scenario('cached session restores once and ignores a stale cold-start OAuth URL', async () => {
  let callbacks = 0;
  const { controller, emit, profileCalls } = setup({
    readInitialUrl: async () => 'kleaguediary://auth-callback#old-token',
    consumeCallback: async () => { callbacks++; },
  });
  await controller.start();
  emit('INITIAL_SESSION', session());
  emit('SIGNED_IN', session());
  emit('TOKEN_REFRESHED', session('user-a', 'new-token'));
  await tick();
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().session.access_token, 'new-token');
  assert.equal(profileCalls(), 1);
  assert.equal(callbacks, 0);
  controller.stop();
});

scenario('no stored session and a successful cold callback restore the user', async () => {
  const { controller } = setup({
    auth: { getSession: async () => ({ data: { session: null }, error: null }) },
    readInitialUrl: async () => 'kleaguediary://auth-callback#tokens',
    consumeCallback: async () => session(),
  });
  await controller.start();
  assert.equal(controller.getState().status, 'ready');
  controller.stop();
});

scenario('profile timeout is recoverable and never means a new account', async () => {
  const { controller } = setup({ loadProfile: () => new Promise(() => {}) });
  await controller.start();
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().session.user.id, 'user-a');
  controller.stop();
});

scenario('an actual missing profile is the only successful onboarding case', async () => {
  const { controller } = setup({ loadProfile: async () => null });
  await controller.start();
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().profile, null);
  controller.stop();
});

scenario('a profile network error does not silently become onboarding', async () => {
  const { controller } = setup({ loadProfile: async () => { throw new Error('offline'); } });
  await controller.start();
  assert.equal(controller.getState().status, 'error');
  controller.stop();
});

scenario('a late profile response cannot restore a signed-out user', async () => {
  const pending = deferred();
  const { controller, emit } = setup({ loadProfile: () => pending.promise });
  const startup = controller.start();
  await until(() => controller.getState().status === 'profile');
  emit('SIGNED_OUT', null);
  pending.resolve({ id: 'user-a' });
  await startup;
  await tick();
  assert.equal(controller.getState().status, 'signedOut');
  assert.equal(controller.getState().profile, null);
  controller.stop();
});

scenario('switching accounts rejects stale results from the previous account', async () => {
  const pending = deferred();
  const { controller, emit } = setup({ loadProfile: (id) => id === 'user-a' ? pending.promise : Promise.resolve({ id }) });
  const startup = controller.start();
  await until(() => controller.getState().status === 'profile');
  emit('SIGNED_IN', session('user-b'));
  await until(() => controller.getState().profile?.id === 'user-b');
  pending.resolve({ id: 'user-a' });
  await startup;
  assert.equal(controller.getState().profile.id, 'user-b');
  controller.stop();
});

scenario('auth notification never performs queries inline', async () => {
  const { controller, emit, profileCalls } = setup({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } });
  await controller.start();
  emit('SIGNED_IN', session());
  assert.equal(profileCalls(), 0);
  await until(() => controller.getState().status === 'ready');
  assert.equal(profileCalls(), 1);
  controller.stop();
});

scenario('unmount cancels pending restoration without publishing late state', async () => {
  const pending = deferred();
  let changes = 0;
  const { controller } = setup({ auth: { getSession: () => pending.promise }, onChange: () => changes++ });
  const startup = controller.start();
  controller.stop();
  const count = changes;
  pending.resolve({ data: { session: session() }, error: null });
  await startup;
  assert.equal(changes, count);
});

scenario('late session restoration cannot consume an old callback after its deadline', async () => {
  const pending = deferred();
  let callbacks = 0;
  const { controller } = setup({
    auth: { getSession: () => pending.promise },
    readInitialUrl: async () => 'kleaguediary://auth-callback',
    consumeCallback: async () => { callbacks++; return session(); },
  });
  await controller.start();
  pending.resolve({ data: { session: null }, error: null });
  await tick();
  assert.equal(controller.getState().status, 'error');
  assert.equal(callbacks, 0);
  controller.stop();
});

scenario('a completed profile save from another account cannot replace the current profile', async () => {
  const { controller } = setup();
  await controller.start();
  controller.updateProfile({ id: 'user-b', nickname: 'Other user' });
  assert.equal(controller.getState().profile.id, 'user-a');
  controller.stop();
});
