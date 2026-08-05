import { Platform } from 'react-native';
import { login as kakaoLogin, logout as kakaoLogout, unlink as kakaoUnlink } from '@react-native-seoul/kakao-login';
import { supabase } from './api';

// Native login goes through Kakao's own SDK rather than a browser OAuth
// redirect. The browser route kept dying at "카카오톡으로 로그인": that path
// leaves for the KakaoTalk app and comes back, and browsers disagree about
// whether to then follow a redirect into our custom scheme - when one refuses,
// the tokens never reach the app at all and there is nothing the app can do
// about it. The SDK talks to KakaoTalk directly (falling back to account login
// on its own if KakaoTalk is missing), so no browser is involved.
//
// Kakao issues an OpenID Connect id_token, which Supabase verifies itself.
// That requires, on the Kakao side:
//   - 카카오 로그인 -> 일반 -> OpenID Connect: ON
//   - 앱 설정 -> 플랫폼 -> Android: package name + key hash registered
// and on the Supabase side, the Kakao provider's key must match the key the
// token was issued to - the native app key, since that is what the SDK uses.
export async function signInWithKakao() {
  if (!supabase) {
    throw new Error('Supabase가 아직 설정되지 않았습니다. constants/supabaseConfig.js를 확인해주세요.');
  }

  if (Platform.OS === 'web') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    if (data?.url) window.location.href = data.url;
    return null;
  }

  const token = await kakaoLogin();
  if (!token?.idToken) {
    throw new Error('카카오에서 로그인 토큰을 받지 못했습니다. OpenID Connect 설정을 확인해주세요.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'kakao',
    token: token.idToken,
    // Kakao's id_token carries an at_hash, which Supabase checks against this.
    access_token: token.accessToken,
  });
  if (error) throw error;

  return data.session;
}

export async function signOut() {
  if (Platform.OS !== 'web') {
    // Clears the Kakao session too, so the next sign-in actually prompts
    // instead of silently reusing whoever logged in last.
    await kakaoLogout().catch(() => {});
  }
  if (!supabase) return;
  await supabase.auth.signOut();
}

// Severs the Kakao app connection entirely, not just this session - the right
// counterpart to deleting the account.
export async function unlinkKakao() {
  if (Platform.OS === 'web') return;
  await kakaoUnlink().catch(() => {});
}
