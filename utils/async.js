export function withTimeout(operation, timeoutMs = 15000, message = '응답이 지연되고 있습니다. 다시 시도해주세요.') {
  let timer;
  return Promise.race([
    Promise.resolve(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(message);
        error.code = 'TIMEOUT';
        reject(error);
      }, timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Bound the actual request as well as the UI wait. Preserve caller cancellation.
export function createTimedFetch(fetchImpl, lifetimeSignal, timeoutMs = 12000) {
  return async (input, options = {}) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const signals = [options.signal, lifetimeSignal].filter(Boolean);
    signals.forEach((signal) => {
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
    try {
      return await withTimeout(
        fetchImpl(input, { ...options, signal: controller.signal }),
        timeoutMs,
        '서버 연결이 지연되고 있습니다. 네트워크를 확인하고 다시 시도해주세요.',
      );
    } catch (error) {
      abort();
      throw error;
    } finally {
      signals.forEach((signal) => signal.removeEventListener('abort', abort));
    }
  };
}
