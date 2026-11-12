import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { supabase, getProfileForSession } from '../utils/api';
import { consumeAuthCallbackUrl, signOut } from '../utils/auth';
import { createSessionController } from '../utils/sessionLifecycle';
import { bindNativeAutoRefresh } from '../utils/oauthFlow';

const initialState = { status: 'restoring', session: null, profile: null, error: null };

export default function useAuthSession() {
  const [state, setState] = useState(initialState);
  const [version, setVersion] = useState(0);
  const controllerRef = useRef(null);
  const cleanupRef = useRef(() => {});
  const mounted = useRef(true);
  const resetting = useRef(false);
  const resetFailed = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = createSessionController({
      auth: supabase?.auth,
      loadProfile: getProfileForSession,
      readInitialUrl: () => Platform.OS === 'web' || version > 0 ? Promise.resolve(null) : Linking.getInitialURL(),
      consumeCallback: consumeAuthCallbackUrl,
      onChange: (next) => {
        if (mounted.current && controllerRef.current === controller) setState(next);
      },
    });
    controllerRef.current = controller;
    void controller.start();
    const stopRefresh = bindNativeAutoRefresh(supabase?.auth, AppState, Platform.OS === 'web');
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      consumeAuthCallbackUrl(url).catch((error) => controller.reportError(error));
    });
    const cleanup = () => {
      controller.stop();
      stopRefresh();
      linkSub.remove();
    };
    cleanupRef.current = cleanup;
    return () => { mounted.current = false; cleanup(); };
  }, [version]);

  const reset = async () => {
    if (resetting.current) return;
    resetting.current = true;
    cleanupRef.current();
    setState(initialState);
    try {
      await signOut();
      resetFailed.current = false;
      if (mounted.current) setVersion((value) => value + 1);
    } catch (error) {
      resetFailed.current = true;
      if (mounted.current) setState({ ...initialState, status: 'error', error });
    } finally {
      resetting.current = false;
    }
  };

  return {
    ...state,
    retry: () => resetFailed.current ? reset() : controllerRef.current?.retry(),
    reset,
    updateProfile: (profile) => controllerRef.current?.updateProfile(profile),
  };
}
