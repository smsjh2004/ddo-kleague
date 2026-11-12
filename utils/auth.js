import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase, resetAuthClient } from './supabaseClient';
import { withTimeout } from './async';
import { createCallbackConsumer, waitForNativeRedirect } from './oauthFlow';

WebBrowser.maybeCompleteAuthSession();

const NATIVE_REDIRECT_URL = 'kleaguediary://auth-callback';
const BRIDGE_REDIRECT_URL = 'https://smsjh2004.github.io/ddo-kleague/auth.html';
export { isAuthCallbackUrl } from './oauthFlow';
export const consumeAuthCallbackUrl = createCallbackConsumer(() => supabase?.auth);
let signInPromise = null;

async function openKakaoLogin() {
  const client = supabase;
  if (!client) throw new Error('로그인 서버가 설정되지 않았습니다.');
  const isWeb = Platform.OS === 'web';
  const { data, error } = await withTimeout(client.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: isWeb ? window.location.origin : BRIDGE_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  }));
  if (error) throw error;
  if (!data?.url) throw new Error('로그인 주소를 받지 못했습니다. 다시 시도해주세요.');
  if (isWeb) {
    window.location.assign(data.url);
    return null;
  }
  let callbackUrl;
  try {
    callbackUrl = await waitForNativeRedirect({
      linking: Linking,
      appState: AppState,
      openBrowser: () => WebBrowser.openAuthSessionAsync(data.url, NATIVE_REDIRECT_URL),
    });
  } finally {
    try {
      if (Platform.OS === 'ios') WebBrowser.dismissAuthSession();
      else await withTimeout(WebBrowser.dismissBrowser(), 1500);
    } catch { /* No browser left to dismiss. */ }
  }
  if (client !== supabase) throw new Error('로그인 상태가 초기화되었습니다. 다시 시도해주세요.');
  if (callbackUrl) {
    const session = await consumeAuthCallbackUrl(callbackUrl);
    if (session) return session;
  } else {
    const { data: current, error: sessionError } = await withTimeout(client.auth.getSession());
    if (sessionError) throw sessionError;
    if (current.session) return current.session;
  }
  throw new Error('로그인이 취소되었거나 완료되지 않았습니다. 다시 시도해주세요.');
}

export function signInWithKakao() {
  if (!signInPromise) {
    signInPromise = openKakaoLogin().finally(() => { signInPromise = null; });
  }
  return signInPromise;
}

export async function signOut() {
  if (!supabase) return;
  // Revoke this device's token when reachable. Recovery must also work offline.
  await withTimeout(supabase.auth.signOut({ scope: 'local' }), 3000).catch(() => {});
  await resetAuthClient();
}
