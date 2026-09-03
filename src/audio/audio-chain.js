import { createAudioEngine } from './audio-engine.js';

// An HTMLMediaElement may back exactly ONE MediaElementAudioSourceNode — for the life of
// that element, across every AudioContext. Start can run more than once (a failed attempt
// drops the user back on the start screen to try again, and nothing stops a second click),
// and rebuilding the chain threw
//
//   InvalidStateError: Failed to execute 'createMediaElementSource' on 'AudioContext':
//   HTMLMediaElement already connected previously to a different MediaElementSourceNode.
//
// which buried the real first failure under a misleading one and left the page dead until
// a reload. So the context, the source node and the FX graph are built on the first call
// and handed back on every later one. Reusing them also stops a retry from stacking a
// second AudioContext and a second FX graph on the same source, which would double the
// audio even if the element allowed it.
export function createAudioChain({ createContext, createEngine = createAudioEngine }) {
  let chain = null;
  return async function getAudioChain(mediaEl) {
    if (!chain) {
      // Assigned only once everything succeeded: a half-built chain must not be cached,
      // or a transient failure would poison every later attempt.
      const ctx = createContext();
      const source = ctx.createMediaElementSource(mediaEl);
      chain = { ctx, source, engine: createEngine(ctx, source) };
    }
    // Resume on every attempt, not only the first — a context can be suspended between
    // them by the autoplay policy or a backgrounded tab, and a retry that skipped this
    // would come up silent.
    await chain.ctx.resume();
    return chain;
  };
}
