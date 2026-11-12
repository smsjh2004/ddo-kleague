import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/supabaseConfig';
import { createTimedFetch, withTimeout } from './async';

// Keep Supabase's existing key so installed users retain their sessions.
const storageKey = SUPABASE_URL ? `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token` : null;
const rawStorage = Platform.OS === 'web' ? {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
} : AsyncStorage;
let lifetime;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const scope = { active: true, abort: new AbortController() };
  lifetime = scope;
  const authStorage = {
    getItem: (key) => scope.active ? withTimeout(Promise.resolve().then(() => rawStorage.getItem(key)), 5000) : Promise.resolve(null),
    setItem: (key, value) => scope.active ? withTimeout(Promise.resolve().then(() => scope.active && rawStorage.setItem(key, value)), 5000) : Promise.resolve(),
    removeItem: (key) => scope.active ? withTimeout(Promise.resolve().then(() => scope.active && rawStorage.removeItem(key)), 5000) : Promise.resolve(),
  };
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey,
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
    global: { fetch: createTimedFetch((...args) => fetch(...args), scope.abort.signal) },
  });
}

export let supabase = createSupabaseClient();

// Explicit recovery/log-out only. Do not erase preferences or diary caches.
// Retiring the old storage adapter prevents late refreshes restoring old tokens.
export async function resetAuthClient() {
  if (!storageKey) return;
  if (lifetime) {
    lifetime.active = false;
    lifetime.abort.abort();
  }
  const oldClient = supabase;
  if (oldClient) {
    await withTimeout(oldClient.auth.dispose(), 1500).catch(() => {});
  }
  await withTimeout(Promise.all([
    storageKey, `${storageKey}-code-verifier`, `${storageKey}-user`,
  ].map((key) => rawStorage.removeItem(key))), 5000);
  // Avoid re-consuming an OAuth hash on an explicit web sign-out/recovery.
  if (Platform.OS === 'web' && /(?:access_token|refresh_token|error_description)=/.test(window.location.hash)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  supabase = createSupabaseClient();
}
