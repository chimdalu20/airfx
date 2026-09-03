# Task 12 Report: Full Control Loop Wiring

## What Was Wired

`src/main.js` was replaced verbatim per the brief's Step 1. The new file wires:

- **Camera → signals:** `CameraGestureSource.start(onFrame)` callback receives each `RawFrame`; `leftPipe` and `rightPipe` (each a `makeHandPipeline` closure) process `frame.left`/`frame.right` with calibration, One-Euro smoothing, presence hysteresis, and finger debouncing → `signals` object.
- **Signals → mapping:** `mapSignalsToSnapshot(signals)` converts normalized signals to an audio `snapshot`.
- **Snapshot → audio engine:** `engine.apply(snapshot)` applies all AudioParam ramps per frame.
- **Snapshot → animated rack:** `rack.update(snapshot)` drives the controls panel knob animations.
- **Signals → meters:** `meters.update(signals)` drives the VU meter display.
- **Frame → overlay:** `overlay.draw(frame._landmarks || [])` draws the hand skeleton on the canvas.
- **Panic button:** `document.getElementById('panicBtn').addEventListener('click', () => engine.panic())` wired after camera starts.
- **Profile management:** module-level `profile = DEFAULT_PROFILE`, exported `getProfile`/`setProfile`, consumed by `makeHandPipeline` via closure.
- **Dev handle:** `window.__airfx = { ctx, engine, camera, setProfile }` for browser console access.
- **Two pipelines:** `makeHandPipeline('left')` and `makeHandPipeline('right')` are both created; `fingers` tracking is left-only (`if (side === 'left')`).

## node --check Result

```
EXIT:0
```
No syntax errors. (Browser globals and bare `@mediapipe/tasks-vision` import are expected to be absent in Node — not checked by `--check`.)

## npm test Result

```
tests 38 | pass 38 | fail 0 | cancelled 0 | skipped 0
duration_ms 406.8419
```
All 38 existing tests pass. Task 12 adds no new Node tests (browser-only integration).

## Import-Resolution Sanity Check

All imports in the new `main.js` resolved against real exports confirmed by grepping `export` lines across `src/**/*.js`:

| Import symbol | Module | Export verified |
|---|---|---|
| `createAudioEngine` | `./audio/audio-engine.js` | ✓ |
| `CameraGestureSource` | `./gestures/camera-source.js` | ✓ |
| `applyCalibration` | `./calibration/profile.js` | ✓ |
| `DEFAULT_PROFILE` | `./calibration/profile.js` | ✓ |
| `OneEuroFilter` | `./smoothing/one-euro.js` | ✓ |
| `Debounced` | `./smoothing/debounce.js` | ✓ |
| `Hysteresis` | `./smoothing/debounce.js` | ✓ |
| `mapSignalsToSnapshot` | `./mapping/mapping.js` | ✓ |
| `createControlsPanel` | `./ui/controls-panel.js` | ✓ |
| `createMeters` | `./ui/meters.js` | ✓ |
| `createOverlay` | `./ui/overlay.js` | ✓ |
| `SMOOTH` | `./config.js` | ✓ |
| `DEBOUNCE` | `./config.js` | ✓ |
| `PRESENCE` | `./config.js` | ✓ |

No mismatches. Zero NEEDS_CONTEXT issues.

## Live Verification (Step 2) — DEFERRED

Step 2 requires opening Chrome with a real camera + headphones, clicking Start, and observing:
- Hand skeleton overlay drawing
- Live meter updates
- Left/right hand gesture → knob sweep → audible effect changes
- Panic/mute working

This cannot be run in a headless environment. Deferred to a manual or Playwright-driven browser pass.

## Self-Review

- **camera.start callback** wires: signals → mapping → engine.apply ✓, rack.update ✓, meters.update ✓, overlay.draw ✓
- **Panic button** wired via `panicBtn` click → `engine.panic()` ✓
- **Two `makeHandPipeline` instances** created for `'left'` and `'right'` ✓
- **Profile** module-level (`DEFAULT_PROFILE`), accessible via exported `getProfile`/`setProfile`, consumed inside each pipeline closure via `profile[side]` ✓
- **Error path** shows `startError` with `e.name – e.message` ✓
- **DOM show/hide** correct order: init camera, build UI, then hide startScreen + show app before `camera.start` ✓

## Concerns

None functional. One note: the prior `main.js` had an `applyCalibration` call using `profile[side]` via a passed-in `getProfile` function (more testable), while the brief's version closes over the module-level `profile` variable directly. The brief was followed verbatim — this is by design per the spec.

## Commit

- SHA: `6db21fb`
- Subject: `feat: full control loop wiring (camera -> audio + animated rack)`
- Branch: `implementation`
- Files changed: `src/main.js` only (targeted `git add src/main.js`)
