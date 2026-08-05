import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from './api';

WebBrowser.maybeCompleteAuthSession();

// How long the app must sit in the foreground with no deep link before we
// accept that the user really did back out of the login page.
const FOREGROUND_GRACE_MS = 4000;
// Hard ceiling so a stuck login can never hang the button forever.
const MAX_WAIT_MS = 120000;
const NATIVE_REDIRECT_URL = 'kleaguediary://auth-callback';

// Resolves with the deep-link URL, or null once the user has clearly given up.
// The clock only runs while our app is in front: if we're backgrounded the
// browser still owns the screen and the login is simply still in progress.
function waitForDeepLink(deepLinkPromise) {
  return new Promise((resolve) => {
    let settled = false;
    let graceTimer = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      clearTimeout(ceilingTimer);
      appStateSub.remove();
      resolve(value);
    };

    const startGrace = () => {
      clearTimeout(graceTimer);
      graceTimer = setTimeout(() => finish(null), FOREGROUND_GRACE_MS);
    };

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') startGrace();
      else clearTimeout(graceTimer);
    });

    const ceilingTimer = setTimeout(() => finish(null), MAX_WAIT_MS);

    deepLinkPromise.then(finish);
    if (AppState.currentState === 'active') startGrace();
  });
}

// Opens the Kakao login page (via Supabase Auth) and resolves once the user
// is signed in, or throws if they cancel / something fails.
export async function signInWithKakao() {
  if (!supabase) {
    throw new Error('Supabase가 아직 설정되지 않았습니다. constants/supabaseConfig.js를 확인해주세요.');
  }

  // Native uses a custom-scheme deep link (kleaguediary://auth-callback) that
  // WebBrowser.openAuthSessionAsync captures and we parse manually below. Web
  // has to land back on a path this single-page app actually serves, so it
  // just goes back to the site root - supabase-js auto-detects the session
  // tokens in the URL hash on load there (detectSessionInUrl, on by default).
  const redirectTo = Platform.OS === 'web' ? window.location.origin : NATIVE_REDIRECT_URL;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;

  if (Platform.OS === 'web') {
    window.location.href = data.url;
    return null;
  }

  // Android routes the redirect by firing an intent, which foregrounds the app
  // *before* the deep link reaches JS. openAuthSessionAsync only watches the
  // app coming back to the foreground, so it reports "dismiss" while the
  // tokens are still in flight. Listen for the deep link ourselves and, on a
  // dismiss, give that link a moment to land before treating it as a failure.
  let deepLinkUrl = null;
  let deepLinkSubscription = null;
  const isAuthCallback = (url) => url.includes('auth-callback') || url.startsWith(redirectTo);
  const deepLinkPromise = new Promise((resolve) => {
    deepLinkSubscription = Linking.addEventListener('url', ({ url }) => {
      if (isAuthCallback(url)) {
        deepLinkUrl = url;
        resolve(url);
      }
    });
  });

  let result;
  let finalUrl;
  try {
    result = await Promise.race([
      WebBrowser.openAuthSessionAsync(data.url, redirectTo),
      deepLinkPromise.then((url) => ({ type: 'success', url })),
    ]);

    finalUrl = result.type === 'success' ? result.url : deepLinkUrl;

  // A "dismiss" only means the app came to the foreground, which also happens
  // mid-login whenever the browser hands off (Kakao's 간편로그인 bounces
  // through the KakaoTalk app) - so it fires long before the tokens exist.
  // Treat it as a real cancel only once the app has actually stayed in front
  // with no deep link; while we're still backgrounded the browser is up and
  // the user is mid-flow, so keep waiting.
    if (!finalUrl) finalUrl = await waitForDeepLink(deepLinkPromise);
  } finally {
    deepLinkSubscription?.remove();
  }

  if (!finalUrl) {
    throw new Error(`로그인이 완료되지 않았습니다 (${result.type})`);
  }

  const { params, errorCode } = QueryParams.getQueryParams(finalUrl);
  if (errorCode) throw new Error(`${errorCode}: ${params.error_description || ''}`);
  if (!params.access_token || !params.refresh_token) {
    throw new Error('로그인 응답에서 세션 정보를 찾을 수 없습니다.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (sessionError) throw sessionError;

  return sessionData.session;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
