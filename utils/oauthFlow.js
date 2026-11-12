import { withTimeout } from './async.js';

export function isAuthCallbackUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'kleaguediary:' && (url.hostname === 'auth-callback' || (!url.hostname && url.pathname === '/auth-callback'));
  } catch {
    return false;
  }
}

export function createCallbackConsumer(getAuth, timeoutMs = 15000) {
  let lastAuth;
  let lastUrl;
  let lastResult;
  return function consume(url) {
    const auth = getAuth();
    if (!auth || !isAuthCallbackUrl(url)) return Promise.resolve(null);
    if (auth === lastAuth && url === lastUrl && lastResult) return lastResult;
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => params.set(key, value));
    if (params.has('error') || params.has('error_code')) {
      return Promise.reject(new Error('카카오 로그인을 완료하지 못했습니다. 다시 시도해주세요.'));
    }
    const code = params.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!code && !(accessToken && refreshToken)) return Promise.resolve(null);
    lastAuth = auth;
    lastUrl = url;
    const operation = withTimeout((async () => {
      let response;
      if (code) {
        response = await auth.exchangeCodeForSession(code);
      } else {
        const current = await auth.getSession();
        if (current.data?.session?.access_token === accessToken) return current.data.session;
        response = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
      if (response.error) throw response.error;
      return response.data.session;
    })(), timeoutMs);
    lastResult = operation;
    operation.catch(() => {
      if (lastResult === operation) { lastUrl = null; lastResult = null; }
    });
    return operation;
  };
}

// Android can report "dismiss" before the Kakao deep link arrives. Wait only
// while a foreground grace period or the overall login deadline permits it.
export function waitForNativeRedirect({ linking, appState, openBrowser, timeoutMs = 120000, graceMs = 4000 }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let browserDismissed = false;
    let graceTimer;
    let deadline;
    let linkSub;
    let stateSub;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(graceTimer);
      linkSub?.remove();
      stateSub?.remove();
      if (error) reject(error);
      else resolve(value);
    };
    const foreground = (state) => {
      clearTimeout(graceTimer);
      if (browserDismissed && state === 'active') graceTimer = setTimeout(() => finish(null), graceMs);
    };
    linkSub = linking.addEventListener('url', ({ url }) => {
      if (isAuthCallbackUrl(url)) finish(url);
    });
    stateSub = appState.addEventListener('change', foreground);
    deadline = setTimeout(() => {
      const error = new Error('로그인 대기 시간이 지났습니다. 다시 시도해주세요.');
      error.code = 'TIMEOUT';
      finish(null, error);
    }, timeoutMs);
    Promise.resolve().then(openBrowser).then((result) => {
      if (settled) return;
      if (result.type === 'success' && isAuthCallbackUrl(result.url)) finish(result.url);
      else {
        browserDismissed = true;
        foreground(appState.currentState);
      }
    }, (error) => finish(null, error));
  });
}

export function bindNativeAutoRefresh(auth, appState, isWeb) {
  if (!auth || isWeb) return () => {};
  const sync = (state) => {
    const operation = state === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh();
    Promise.resolve(operation).catch(() => {});
  };
  sync(appState.currentState);
  const subscription = appState.addEventListener('change', sync);
  return () => {
    subscription.remove();
    Promise.resolve(auth.stopAutoRefresh()).catch(() => {});
  };
}
