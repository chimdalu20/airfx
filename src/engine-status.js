// Shared readiness for the hand-tracking engine.
//
// The engine is a CDN download (WASM runtime + model) that takes seconds on a cold cache.
// The app used to reveal itself and then sit there doing nothing until it landed, which reads
// as a broken page. The tour now opens immediately and consults this object, so the wait is
// spent learning the app instead of staring at it — and any step that genuinely needs
// tracking says so by name rather than silently not working.

export function createEngineStatus(name) {
  let state = 'loading'; // 'loading' | 'ready' | 'error'
  let error = null;
  const listeners = new Set();
  const emit = () => { for (const fn of [...listeners]) fn(state, error); };

  return {
    name,
    getState: () => state,
    isReady: () => state === 'ready',
    isLoading: () => state === 'loading',
    getError: () => error,

    ready() {
      if (state === 'ready') return;
      state = 'ready';
      error = null;
      emit();
    },
    // A retry after a failed start is a fresh download, not the old error. Without this
    // the tour kept showing the previous failure while the engine was loading again.
    loading() {
      if (state === 'loading') return;
      state = 'loading';
      error = null;
      emit();
    },
    fail(err) {
      state = 'error';
      error = err || new Error('unknown');
      emit();
    },

    // Returns an unsubscribe function, so a torn-down tour cannot leak a listener that
    // writes into removed DOM.
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
