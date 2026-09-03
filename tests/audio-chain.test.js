import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioChain } from '../src/audio/audio-chain.js';

// Mirrors the browser rule this module exists for: an HTMLMediaElement may back exactly
// ONE MediaElementAudioSourceNode, for the life of the element and across every
// AudioContext. Chrome throws InvalidStateError on the second attempt.
function makeContextFactory() {
  const connected = new WeakSet();
  const contexts = [];
  const createContext = () => {
    const ctx = {
      resumes: 0,
      resume() { ctx.resumes++; return Promise.resolve(); },
      createMediaElementSource(el) {
        if (connected.has(el)) {
          const err = new Error("Failed to execute 'createMediaElementSource' on 'AudioContext': "
            + 'HTMLMediaElement already connected previously to a different MediaElementSourceNode.');
          err.name = 'InvalidStateError';
          throw err;
        }
        connected.add(el);
        return { el };
      },
    };
    contexts.push(ctx);
    return ctx;
  };
  return { contexts, createContext };
}

test('a second attempt reuses the chain instead of re-connecting the track element', async () => {
  const factory = makeContextFactory();
  const engines = [];
  const getChain = createAudioChain({
    createContext: factory.createContext,
    createEngine: (ctx, source) => { const e = { ctx, source }; engines.push(e); return e; },
  });
  const trackEl = {};

  const first = await getChain(trackEl);
  const second = await getChain(trackEl);

  assert.equal(second, first, 'the same chain must come back');
  assert.equal(second.source, first.source);
  assert.equal(second.engine, first.engine);
  assert.equal(factory.contexts.length, 1, 'one AudioContext, not one per attempt');
  assert.equal(engines.length, 1, 'one FX graph, or the source is processed twice');
});

test('the context is resumed on every attempt, not only the first', async () => {
  const factory = makeContextFactory();
  const getChain = createAudioChain({
    createContext: factory.createContext,
    createEngine: () => ({}),
  });
  const trackEl = {};

  await getChain(trackEl);
  await getChain(trackEl);

  // A context suspended between attempts (autoplay policy, backgrounded tab) has to be
  // woken again, or the retry succeeds silently with no sound.
  assert.equal(factory.contexts[0].resumes, 2);
});

test('a failed context build does not poison later attempts', async () => {
  const factory = makeContextFactory();
  let fail = true;
  const getChain = createAudioChain({
    createContext: () => { if (fail) throw new Error('no audio device'); return factory.createContext(); },
    createEngine: () => ({}),
  });
  const trackEl = {};

  await assert.rejects(() => getChain(trackEl), /no audio device/);
  fail = false;
  const chain = await getChain(trackEl);
  assert.ok(chain.source, 'the retry after a failed build must still be able to connect');
});
