import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from './api';

WebBrowser.maybeCompleteAuthSession();

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
  const redirectTo = Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Only request the consent items actually enabled in the Kakao app
      // (동의항목) - excluding account_email avoids needing Kakao business
      // verification, since the app only needs nickname/profile photo.
      scopes: 'profile_nickname profile_image',
    },
  });
  if (error) throw error;

  if (Platform.OS === 'web') {
    window.location.href = data.url;
    return null;
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('로그인이 취소되었습니다.');
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);
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
