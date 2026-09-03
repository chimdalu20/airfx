# Task 9 Report: Gesture Sources + Signals Pipeline

## Files

- **Created:** `src/gestures/synthetic-source.js`
- **Created:** `src/gestures/camera-source.js`
- **Modified:** `src/main.js` (added imports + `makeHandPipeline` + `createSignalPipeline`)
- **Created:** `tests/synthetic-source.test.js`

## TDD: SyntheticGestureSource

**RED** (Step 2): `node --test tests/synthetic-source.test.js` → `ERR_MODULE_NOT_FOUND` (module did not exist).

**GREEN** (Step 4): After implementing `src/gestures/synthetic-source.js`, both tests pass:
- `sample() returns whatever the fn produces` ✔
- `fn receives the timestamp` ✔

## `node --check` Results

All three files parse cleanly (zero output = success):
- `node --check src/gestures/synthetic-source.js` — OK
- `node --check src/gestures/camera-source.js` — OK (bare `@mediapipe/tasks-vision` import and browser globals `navigator`, `performance`, `requestAnimationFrame` are not resolved at parse time, as expected)
- `node --check src/main.js` — OK

## `npm test` Result

37 tests, 37 pass, 0 fail (suite grew from 35 → 37 with the 2 new synthetic-source tests).

## Step 7: Intentionally Skipped

Step 7 (temporary synthetic auto-run block in `start()`) was not added per the task instructions for this headless environment. There is no display, camera, or audio output available, so the browser-console live verification is not possible. Live verification is deferred to a full browser session in a later task (Task 13 wires the real pipeline).

## Self-Review

- `SyntheticGestureSource` matches the brief verbatim: `constructor(fn)`, `sample(tMs)`, `start(onFrame, intervalMs=33)`, `stop()`.
- `CameraGestureSource` matches the brief verbatim: `constructor(videoEl)`, `async init()`, `start(onFrame)`, `stop()`, `_toRawFrame(res, tMs)`. WASM/MODEL URLs pinned to `@mediapipe/tasks-vision@0.10.35` per global constraints. GPU delegate, VIDEO mode, numHands=2 all set correctly.
- `makeHandPipeline` and `createSignalPipeline` are verbatim from brief Step 6. The `RawFrame` shape (`{ tMs, left, right }`) and pipeline signatures match the brief exactly, as required for later tasks.
- Imports added to `src/main.js`: `applyCalibration`, `DEFAULT_PROFILE`, `OneEuroFilter`, `Debounced`, `Hysteresis`, `mapSignalsToSnapshot`, `SMOOTH`, `DEBOUNCE`, `PRESENCE`. All resolve to existing modules.
- Commit uses targeted `git add` (exactly the 4 task-9 files). Co-authored trailer present.

## Concerns

None. The only outstanding item is live browser verification (Step 7 deferred by design).

## Commit

SHA: `0ca91d5`
Subject: `feat: gesture sources + calibration/smoothing signal pipeline`
