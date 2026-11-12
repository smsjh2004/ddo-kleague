import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as asyncHelpers from '../utils/async.js';
const require = createRequire(import.meta.url);
const babel = require('@babel/core');

// Only the platform I/O is substituted. Execute the production client factory
// and reset function so the persisted key and retired-adapter guard are tested.
for (const platform of ['web', 'android']) {
  test(`${platform}: recovery removes only auth keys and rejects writes from the retired client`, async () => {
    const key = 'sb-test-project-auth-token';
    const stored = new Map([[key, 'old'], [`${key}-user`, 'user'], [`${key}-code-verifier`, 'code'], ['kleague_logs:user-a', 'diary'], ['kleague_theme_mode', 'dark']]);
    const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: (key) => stored.delete(key) };
    const clients = [];
    const dependencies = {
      'react-native-url-polyfill/auto': {},
      'react-native': { Platform: { OS: platform } },
      '@react-native-async-storage/async-storage': storage,
      '@supabase/supabase-js': { createClient(_url, _key, options) {
        const client = { options, auth: { dispose: async () => {} } };
        clients.push(client);
        return client;
      } },
      '../constants/supabaseConfig': { SUPABASE_URL: 'https://test-project.supabase.co', SUPABASE_ANON_KEY: 'test-key' },
      './async': asyncHelpers,
    };
    const source = fs.readFileSync(new URL('../utils/supabaseClient.js', import.meta.url), 'utf8');
    const { code } = babel.transformSync(source, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] });
    const exports = {};
    vm.runInNewContext(`(function(require,exports){${code}\n})`, {
      URL, AbortController, Promise,
      window: { localStorage: storage, location: { hash: '', pathname: '/', search: '' } },
      fetch: () => { throw new Error('No live network allowed'); },
    })((name) => { assert.ok(name in dependencies, name); return dependencies[name]; }, exports);
    const oldStorage = clients[0].options.auth.storage;
    assert.equal(clients[0].options.auth.storageKey, key);
    await exports.resetAuthClient();
    await oldStorage.setItem(key, 'late-refresh');
    assert.equal(await oldStorage.getItem(key), null);
    assert.equal(stored.has(key), false);
    assert.equal(stored.has(`${key}-user`), false);
    assert.equal(stored.has(`${key}-code-verifier`), false);
    assert.equal(stored.get('kleague_logs:user-a'), 'diary');
    assert.equal(stored.get('kleague_theme_mode'), 'dark');
    assert.equal(clients.length, 2);
    assert.equal(exports.supabase, clients[1]);
    await clients[1].options.auth.storage.setItem(key, 'new-session');
    assert.equal(stored.get(key), 'new-session');
  });
}
