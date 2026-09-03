# Task 1 Report — Audio Plumbing (engine output, mixer, deck)

**Status:** Complete

**Files changed / created:**
- `src/audio/audio-engine.js` — removed limiter, `dest`, and `ctx.destination` / `dest` connections; added `output` GainNode (`master -> output`); return now includes `output` instead of `recorderStream`.
- `src/audio/mixer.js` — new; exports `crossfadeGains(x)` (pure, equal-power) and `createMixer(ctx)` (`inputA`, `inputB`, `setCrossfade`, `panic`, `unmute`, `recorderStream`). Master limiter + recorder live here.
- `src/audio/deck.js` — new; exports `createDeck(ctx, mixerInput)` — builds `<audio>` (loop=true) → `createMediaElementSource` → `createAudioEngine` → `engine.output.connect(mixerInput)`. Exposes `load`, `play`, `pause`, `toggle`, `playing`, `name`, `engine`, `el`.
- `tests/mixer.test.js` — new; 6 tests for `crossfadeGains` (boundary values, 0.5 center, clamping, equal-power property a²+b²=1).

**Tests:** `npm test` — 45/45 pass (6 new mixer tests + 39 existing). All `node --check` clean.

**Concerns:** None. `main.js` still imports the old `createAudioEngine` shape (returning `recorderStream`) and is intentionally left for Task 3 rewire — this is expected per the plan and does not affect tests.
