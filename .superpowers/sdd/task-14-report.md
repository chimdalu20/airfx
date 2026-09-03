# Task 14 Report: Recording / Export

**Status:** DONE_WITH_CONCERNS (live browser verification deferred — headless environment)

## Commit

- SHA: `f1d0898`
- Subject: `feat: record + export processed audio`
- Files: `src/audio/recorder.js` (new), `src/main.js` (modified)

## What Was Done

### Step 1 — `src/audio/recorder.js` (created verbatim)
- Exports `createRecorder(stream)` returning `{ start(), stop()→Promise<Blob>, get active }`.
- Mime-type selection via `MediaRecorder.isTypeSupported`: tries `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → empty string fallback.
- `start()` resets chunks, constructs `MediaRecorder`, hooks `ondataavailable`, calls `.start()`.
- `stop()` returns a Promise that resolves with a `Blob` assembled from collected chunks once `onstop` fires.
- `active` getter: `true` iff `rec.state === 'recording'`.

### Step 2 — `src/main.js` (two targeted insertions)
1. Added `import { createRecorder } from './audio/recorder.js';` as the second import line.
2. After `const engine = createAudioEngine(ctx, audioStream);` in `start()`, inserted:
   - `const recorder = createRecorder(engine.recorderStream);`
   - `recordBtn` click listener: toggles recording state, updates button text/class, and on stop triggers a programmatic `<a>` download of the blob. Extension chosen from `blob.type` (`mp4` vs `webm`).
   - All existing wiring (panic, calibrate, camera loop, `window.__airfx`) left untouched.

## Verification

| Check | Result |
|---|---|
| `node --check src/audio/recorder.js` | OK |
| `node --check src/main.js` | OK |
| `npm test` (38 tests) | 38 pass, 0 fail |
| Live record→download (browser) | DEFERRED — headless environment |

## Concerns

- **Live browser verification deferred**: `MediaRecorder` and `URL.createObjectURL` are browser globals — not testable in Node. The record→download flow must be validated manually with `npm run serve` and a real browser (Chrome/Edge primary). The mime-type fallback chain (`webm;codecs=opus → webm → mp4`) should cover all desktop targets.
- **`engine.recorderStream` contract**: The implementation relies on Task 8's `createAudioEngine` exposing `recorderStream` as a `MediaStreamDestination.stream`. No Node test covers this integration; it is verified only at runtime.
- No new Node tests were added (brief does not call for them; browser-only API).
