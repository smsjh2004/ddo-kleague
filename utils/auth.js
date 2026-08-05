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
// Where the app itself is reachable - this is what actually comes back as a
// deep link, so it stays the URL the browser session watches for.
const NATIVE_REDIRECT_URL = 'kleaguediary://auth-callback';

// Where Supabase is told to send the browser. Handing a custom scheme straight
// to the browser is unreliable: some refuse to follow a redirect into one,
// especially after the flow has bounced out to the KakaoTalk app and back, and
// then the tokens never reach us at all. An https page is always followed, and
// docs/auth.html forwards from there to NATIVE_REDIRECT_URL - with a button if
// the browser blocks even that, since a tap is a user gesture.
// Must be listed under Supabase Auth -> URL Configuration -> Redirect URLs.
const BRIDGE_REDIRECT_URL = 'https://smsjh2004.github.io/ddo-kleague/auth.html';

export function isAuthCallbackUrl(url) {
  return typeof url === 'string' && url.includes('auth-callback');
}

// Turns an OAuth redirect URL into a live session. Safe to call with anything:
// non-callback URLs and callbacks with no tokens are ignored, and re-applying
// a session we already hold is a no-op. Returns the session, or null.
export async function consumeAuthCallbackUrl(url) {
  if (!supabase || !isAuthCallbackUrl(url)) return null;

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(`${errorCode}: ${params.error_description || ''}`);
  if (!params.access_token || !params.refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (error) throw error;
  return data.session;
}

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

  // Two different URLs on native: Supabase sends the browser to the https
  // bridge, and the bridge hands off to the app scheme - so that scheme is
  // what we watch for coming back. Web has no scheme to hop to and just lands
  // back on the site root, where supabase-js picks the tokens out of the URL
  // hash itself (detectSessionInUrl, on by default).
  const isWeb = Platform.OS === 'web';
  const redirectTo = isWeb ? window.location.origin : BRIDGE_REDIRECT_URL;
  const returnUrl = isWeb ? window.location.origin : NATIVE_REDIRECT_URL;

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
  const deepLinkPromise = new Promise((resolve) => {
    deepLinkSubscription = Linking.addEventListener('url', ({ url }) => {
      if (isAuthCallbackUrl(url) || url.startsWith(returnUrl)) {
        deepLinkUrl = url;
        resolve(url);
      }
    });
  });

  let result;
  let finalUrl;
  try {
    result = await Promise.race([
      WebBrowser.openAuthSessionAsync(data.url, returnUrl),
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

  // App.js watches the same deep link and may well have applied it already -
  // in that case there is a session even though we never saw the URL.
  if (!finalUrl) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    throw new Error(`로그인이 완료되지 않았습니다 (${result.type})`);
  }

  const session = await consumeAuthCallbackUrl(finalUrl);
  if (!session) throw new Error('로그인 응답에서 세션 정보를 찾을 수 없습니다.');
  return session;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
