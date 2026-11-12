import { withTimeout } from './async.js';

export function createSessionController({
  auth,
  loadProfile,
  readInitialUrl = async () => null,
  consumeCallback = async () => null,
  onChange = () => {},
  timeoutMs = 15000,
}) {
  let state = { status: 'restoring', session: null, profile: null, error: null };
  let stopped = false;
  let generation = 0;
  let eventVersion = 0;
  let subscription;
  let profileAbort;
  const timers = new Set();

  const publish = (next) => {
    if (stopped) return;
    state = { ...state, ...next };
    onChange(state);
  };
  const invalidate = () => {
    generation++;
    profileAbort?.abort();
  };

  async function acceptSession(nextSession) {
    if (stopped) return;
    const sameUser = nextSession?.user?.id && state.session?.user?.id === nextSession.user.id;
    if (sameUser && ['profile', 'ready'].includes(state.status)) {
      publish({ session: nextSession });
      return;
    }
    invalidate();
    if (!nextSession?.user?.id) {
      publish({ status: 'signedOut', session: null, profile: null, error: null });
      return;
    }
    const run = generation;
    const version = eventVersion;
    profileAbort = new AbortController();
    const signal = profileAbort.signal;
    publish({ status: 'profile', session: nextSession, profile: null, error: null });
    try {
      const profile = await withTimeout(loadProfile(nextSession.user.id, signal), timeoutMs);
      if (run !== generation || stopped || version !== eventVersion) return;
      publish({ status: 'ready', profile });
    } catch (error) {
      if (run !== generation || stopped || version !== eventVersion) return;
      publish({ status: 'error', error });
    } finally {
      if (run === generation) profileAbort?.abort();
    }
  }

  async function restore() {
    invalidate();
    const run = generation;
    const version = eventVersion;
    publish({ status: 'restoring', error: null });
    if (!auth) {
      await acceptSession(null);
      return;
    }
    try {
      const restored = await withTimeout((async () => {
        const { data, error } = await auth.getSession();
        if (error) throw error;
        if (data?.session) return data.session;
        // An Android launch intent can retain an old OAuth URL after refresh.
        // Never replay it over an already-restored session.
        const url = await readInitialUrl();
        if (run !== generation || stopped || version !== eventVersion) return null;
        return url ? await consumeCallback(url) : null;
      })(), timeoutMs);
      if (run !== generation || stopped || version !== eventVersion) return;
      await acceptSession(restored);
    } catch (error) {
      if (run !== generation || stopped || version !== eventVersion) return;
      invalidate();
      publish({ status: 'error', error });
    }
  }

  return {
    getState: () => state,
    async start() {
      if (auth && !subscription) {
        subscription = auth.onAuthStateChange((event, nextSession) => {
          if (stopped || event === 'INITIAL_SESSION') return;
          // Keep SDK notifications synchronous; run any queries in a later task.
          // Same-user refreshes do not supersede a profile already being loaded.
          const sameUser = nextSession?.user?.id && nextSession.user.id === state.session?.user?.id;
          if (!sameUser || !['profile', 'ready'].includes(state.status)) eventVersion++;
          const version = eventVersion;
          const timer = setTimeout(() => {
            timers.delete(timer);
            if (!stopped && version === eventVersion) void acceptSession(nextSession);
          }, 0);
          timers.add(timer);
        }).data.subscription;
      }
      await restore();
    },
    retry: restore,
    updateProfile(profile) {
      if (!state.session?.user?.id || profile?.id !== state.session.user.id) return;
      invalidate();
      publish({ status: 'ready', profile, error: null });
    },
    reportError(error) {
      invalidate();
      publish({ status: 'error', error });
    },
    stop() {
      stopped = true;
      invalidate();
      subscription?.unsubscribe();
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}
