# AirFX — Hand-Gesture Voice Effects (Design Spec)

**Date:** 2026-06-20
**Status:** Approved design — ready for implementation planning
**Working name:** AirFX (placeholder, rename freely)

## 1. Summary

AirFX is a standalone, client-side web app that applies real-time audio effects
(reverb, delay, tremolo, low/high-pass filter) to the user's live microphone voice,
controlled entirely by **webcam hand gestures**. No server, no paid APIs, no native
code — it runs as static files in a desktop browser.

- **Left hand** shapes reverb + delay + filter ("tone").
- **Right hand** controls tremolo.
- **Hand distance from the camera** sets effect intensity (further = more intense).
- **Left-hand height** sets the tone (higher = brighter + lusher; lower = darker + drier).

The product is an **expressive, theremin-style instrument**, not a tight rhythmic
trigger — every control is a continuous sweep.

## 2. Goals & non-goals

**Goals**
- Free / open-source / low-resource; loads easily on the web.
- Fun, experimental, expressive desktop demo that feels musical.
- Polished tool: presets, per-user calibration, recording/export, tuned UI.
- **Live, animated effect controls:** an on-screen rack of knobs/sliders (one group per
  effect — reverb, delay, tremolo, filter) that move in real time as the hands move, so
  the user *sees* each parameter change while gesturing.
- Testable without a camera (synthetic gesture source).

**Non-goals (v1)**
- Mobile-first / phone optimization (desktop-first by explicit choice; UI stays
  window-resize-safe but is not tuned for 375px).
- Pitch-accurate or millisecond-tight triggering (latency makes this a sweep
  instrument, not a drum pad).
- Multi-user, cloud sync, accounts, or any backend.

## 3. Feasibility verdict

**Feasible, with caveats — high confidence.** The pattern is proven by multiple
open-source projects (MediaPipe + Web Audio/Tone.js theremins and "air instruments":
`collidingScopes/arpeggiator`, `monlim/Handmate-Effects`, `ThirstyNeuronsTeam/play_music_in_the_air`).
Three caveats are designed in from the start:

1. **Headphones are mandatory.** Live mic → effects → speakers causes acoustic
   feedback (howlround); reverb/delay worsen it. Headphones eliminate it, also fix
   browser echo-cancellation interference, and make latency feel acceptable. App ships
   a master limiter + panic-mute + headphone warning as backup.
2. **"Distance" is a relative control needing calibration.** A monocular webcam cannot
   measure true distance (small-hand-near looks identical to big-hand-far; per-person
   hand size varies ~25–30%). We use **apparent hand size** (pixel spread between two
   rotation-stable landmarks) as the depth signal, normalized per user via a mandatory
   short **calibration**. We do **not** use MediaPipe `worldLandmarks` or per-landmark
   `z` for camera distance — verified those describe the hand's *internal* 3D shape,
   not its distance from the camera.
3. **Latency is ~40–100 ms (voice→ears) and ~80–200 ms (gesture→audible change).**
   Perfect for expressive sweeps; not for rhythmic triggering. All mappings are sweeps.

**Architecture simplification (verified):** the four effects are all *native* Web Audio
nodes, which already run on a dedicated audio render thread. So **no AudioWorklet is
required**, and audio will not glitch while hand-tracking runs. AudioWorklet would only
be needed for custom hand-written DSP, which this product does not have.

## 4. Stack (all free / OSS / current as of 2026)

| Concern | Choice | Notes |
|---|---|---|
| Language / structure | **Vanilla JS (ES modules) + HTML + CSS**, no framework, no build step | Smallest, fastest-loading, zero toolchain. Loaded via importmap from a CDN in dev; self-host model + WASM in production. |
| Hand tracking | **`@mediapipe/tasks-vision` 0.10.35** — `HandLandmarker`, GPU (WebGL) delegate, `numHands: 2`, `runningMode: 'VIDEO'` | Apache-2.0, actively maintained. Avoid deprecated `@mediapipe/hands` and the stale TF.js wrapper. Model: `hand_landmarker.task` float16 (~7.5 MB); WASM ~860 KB. |
| Audio engine | **Native Web Audio API** | `ConvolverNode` (reverb), `DelayNode`+feedback `GainNode` (delay), `BiquadFilterNode` (filter), `GainNode` modulated by an `OscillatorNode` LFO (tremolo), wet/dry `GainNode`s, master limiter. |
| Smoothing | **One Euro Filter** (~40 lines, public domain) | Adaptive cutoff: low jitter when still, low lag when moving. Beats fixed EMA/lerp. |
| Recording / export | `MediaStreamAudioDestinationNode` → `MediaRecorder` (WebM/Opus); WAV via `OfflineAudioContext` + manual PCM encode | Captures the *processed* signal. Probe with `MediaRecorder.isTypeSupported`. |
| Optional | Tone.js 15.2.7 (MIT) | Only if hand-building effects proves fiddly. Skipped by default (heavier load). |

**Target browsers:** desktop Chrome / Edge (primary). Firefox secondary. Safari best-effort
(no GPU delegate → slower WASM; AudioContext sample-rate quirks).

## 5. Gesture → parameter mapping

All gesture inputs are normalized to 0..1 against the user's calibration before mapping.
Continuous params are applied with `setTargetAtTime` (no zipper noise). Discrete states
use hysteresis + a 3–5 frame debounce so they don't flicker.

### Left hand — reverb / delay / filter ("tone")

| Input | Controls | Mapping |
|---|---|---|
| **Fingers** (count) | which effects are active | `1` finger = reverb; `2` fingers = reverb **+** delay; `0`/fist = bypass left effects |
| **Vertical height** | "tone" axis | higher → brighter (filter cutoff opens, log-mapped ~80 Hz–12 kHz) **and** more reverb; lower → darker + less reverb |
| **Distance from camera** | master intensity | further → wetter / more intense for the whole left chain (reverb wet + delay mix) |

*Rationale:* this reconciles the original spec's "higher = higher filter" and "lower =
lower reverb" onto one natural vertical axis (height = tone, up = brighter+lusher), while
"further = more intense" lives on distance (master wet). Reverb amount is therefore
influenced by both height (its character) and distance (overall how-much) — intentional
and musical.

### Right hand — tremolo

| Input | Controls | Mapping |
|---|---|---|
| **Presence** (hand in frame) | tremolo on/off | raising the right hand engages tremolo |
| **Distance from camera** | tremolo **depth** | further → deeper amplitude wobble (LFO depth 0..1) |
| **Vertical height** | tremolo **rate** | higher → faster (`OscillatorNode.frequency` ≈ 0.1–12 Hz) |

### Signal chain

```
mic → filter → tremolo → delay → reverb → master limiter → destination
```

Both hands operate simultaneously and independently. When a hand leaves frame, its
params **hold last value, then ramp gently to neutral** — never snap.

### Reverb implementation detail

Generate a fixed decaying-noise impulse response once (medium room) and feed a
`ConvolverNode`. "Reverb amount" changes the **wet gain** (cheap, live). Reverb
character is fixed in v1 (regenerating the IR live is expensive); height adjusts wet
gain + filter, which reads as a convincing "more/less reverb."

## 6. Architecture & components

Each unit has one purpose and a defined interface; the gesture source is swappable so
the app is testable and demoable without a camera.

- **`gesture-source`** — owns the camera + `HandLandmarker`; per frame emits
  `{ left, right }`, each `{ present, fingers, heightNorm, distanceNorm, confidence }`.
  - **`CameraGestureSource`** — real webcam + MediaPipe.
  - **`SyntheticGestureSource`** — scripted/manual fake landmarks for tests + no-camera demo.
- **`smoothing`** — One Euro Filter per continuous signal; hysteresis + debounce for
  discrete states (finger count, engage/disengage with separate enter/exit thresholds).
- **`mapping`** — pure functions: normalized 0..1 → audio params, with tuned curves
  (log for filter frequency, perceptual for wet/depth). No side effects → unit-testable.
- **`audio-engine`** — builds the native Web Audio graph; applies all changes via
  `setTargetAtTime`; owns master limiter, panic-mute, and the recorder.
- **`calibration`** — short guided capture of near/far distance and low/high height;
  persisted to `localStorage`; re-runnable.
- **`ui`** — `<video>` + landmark overlay canvas; live meters (detected fingers per hand,
  height, distance); Start button; headphone warning; presets; record/export; calibration
  entry. Desktop-first; window-resize-safe.
- **`controls-panel`** — the live, animated effect rack (see §6.1). One control group per
  effect (reverb / delay / tremolo / filter), each knob/slider reflecting its current
  gesture-driven value in real time, plus an active/bypassed indicator per effect.

### Data flow

```
camera frame (~30fps)
  → HandLandmarker.detectForVideo()
  → per-hand { fingers, heightNorm, distanceNorm, present }
  → One Euro smoothing + discrete debounce
  → mapping (pure)
  → audio-engine: param.setTargetAtTime(...)   [control-rate decoupled from 48kHz audio-rate]
```

### Threading decision

**v1 runs inference on the main thread.** Audio is safe regardless because native nodes
run on the audio render thread. Pace inference with `requestVideoFrameCallback` (fallback
`requestAnimationFrame`). **Optimization (later):** move inference to a Web Worker with
`OffscreenCanvas` *only if the visuals/UI stutter* — and feature-detect the worker GPU
delegate, falling back to main-thread inference if `OffscreenCanvas`/WebGL-in-worker fails.

## 6.1 Live effect controls (animated rack)

The `controls-panel` renders one control group per effect; every knob/slider mirrors the
**current gesture-driven value** so the user watches the controls move as they move their
hands. Controls are **reflective by default** (driven by gestures), with optional manual
override as a future enhancement (see §11).

| Effect | Knobs/sliders shown | Driven by |
|---|---|---|
| **Filter** | cutoff (Hz), resonance | left-hand height (cutoff); resonance fixed/preset |
| **Reverb** | amount/wet, (fixed decay readout) | left-hand height (character) + distance (master wet) |
| **Delay** | mix, time, feedback | left-hand distance (mix); time/feedback preset |
| **Tremolo** | rate (Hz), depth | right-hand height (rate), distance (depth) |

**How it stays smooth and cheap (decoupled from audio):**
- The panel runs its own `requestAnimationFrame` render loop and, each frame, **reads the
  latest smoothed parameter values** the `mapping`/`audio-engine` already computed. It does
  **not** add audio work or re-read landmarks — it only visualizes existing state.
- Each knob is a lightweight DOM/SVG element updated via **CSS `transform: rotate()`** (or a
  stroke-dashoffset arc); no per-frame layout thrash, no canvas redraw cost beyond transforms.
- Values are displayed from the same smoothed signal feeding the audio params, so the knob
  motion matches what the user hears (no second, divergent smoothing).
- Each group shows an **active vs bypassed** state that follows the discrete gesture
  (e.g. reverb lights up at 1 finger; delay lights up at 2; tremolo lights up when the right
  hand is present), with the same hysteresis/debounce as the audio side so it doesn't flicker.

**Interface:** `controlsPanel.update(state)` where `state` is the per-frame snapshot
`{ filter:{cutoff, q}, reverb:{wet}, delay:{mix, time, feedback, active}, tremolo:{rate,
depth, active} }` — the same snapshot the audio engine consumes, so panel and audio never
diverge. This keeps the panel a pure *view* of engine state and independently testable
(feed a snapshot, assert knob angles).

## 7. Error handling & UX guards

- **Start gate:** a single Start button calls `getUserMedia` (camera + mic, requested
  independently) **and** `audioContext.resume()` inside the click handler (autoplay policy
  requires a user gesture).
- **Permissions/devices:** handle `NotAllowedError` / `NotFoundError` / `NotReadableError`
  (device busy) with clear, actionable messages. One stream failing must not kill the other.
- **Mic constraints:** request `{ echoCancellation:false, noiseSuppression:false,
  autoGainControl:false }`, then verify with `track.getSettings()`. Some Chrome/ChromeOS/
  Safari builds refuse to disable these — surface a note and rely on headphones.
- **Lost tracking:** hold last value, show "hand not detected," ramp params gently; never
  emit a sudden jump.
- **Low FPS:** detect and degrade (lower capture resolution, drop to 1 hand).
- **Safety:** master limiter on output + **panic mute** button; headphone-use warning
  banner; clamp delay feedback < ~0.9; cap reverb/delay wet.
- **Secure context:** HTTPS required in production (`localhost` exempt for dev); feature-
  detect `navigator.mediaDevices?.getUserMedia`.
- **Cleanup:** call `landmarker.close()` and stop tracks on teardown (avoid WASM leaks);
  pause/resume cleanly on `visibilitychange`.

## 8. Calibration

A short guided flow on first run (and re-runnable from the UI):
1. "Hold your hand close" → capture max apparent size; "hold it far" → min size.
2. "Raise your hand high" → min y; "lower it" → max y.
3. Store the four bounds per user in `localStorage`; all mappings normalize to 0..1 with
   clamping against them.

Calibration runs automatically on first launch and is prompted whenever no saved profile
exists. A built-in **default profile** ships as a fallback so the app is never blocked —
but the distance/height axes are only reliable after the user calibrates, so the UI nudges
toward it and offers re-calibration at any time.

## 9. Testing strategy

- **Unit tests (no browser/camera):** `mapping` pure functions (curve outputs at 0, 0.5,
  1; clamping), One Euro smoothing behavior, discrete debounce/hysteresis state machine.
  Driven by `SyntheticGestureSource`.
- **Integration (manual + scripted):** `SyntheticGestureSource` feeds known gesture
  sequences; assert the audio graph receives expected target values.
- **Controls panel (pure view):** feed `controlsPanel.update(snapshot)` known snapshots and
  assert knob angles / active states match — independent of audio and camera.
- **UI:** Playwright at a desktop viewport — Start gate, meters render, no console errors,
  no horizontal overflow on resize.
- **On-hardware manual checklist:** real latency (beep-loopback), feedback check on
  headphones vs speakers, tracking under good vs poor lighting, two-hands-in-FOV, low-end
  laptop performance.

## 10. Build roadmap

1. **Skeleton + Start gate** — static page, camera feed, AudioContext, mic passthrough +
   limiter; verify no feedback on headphones.
2. **Tracking + overlay + meters** — landmarks, finger count, height + distance signals,
   smoothing; build the `SyntheticGestureSource` alongside for testing.
3. **Effects + their live knobs, one at a time** — filter → reverb → delay → tremolo. For
   each: wire the mapping, ramp the audio param cleanly, **and render its animated control
   group in the rack** so the knob visibly moves with the gesture before moving to the next
   effect. (Build the `controls-panel` shell + rAF read loop at the start of this step.)
4. **Calibration** + per-user normalization.
5. **Polish** — presets, record/export, headphone warning, low-FPS degrade, panic mute,
   curve tuning, and rack visual polish (active/bypassed states, layout, labels).
6. **Test pass** — mapping/smoothing unit tests, Playwright UI check, on-hardware
   latency/feedback/lighting checklist, low-end laptop run.

## 11. Open questions / future

- Optional Web Worker inference if visuals stutter (documented fallback path exists).
- Optional second right-hand effect (auto-pan/chorus) via right-hand finger gestures —
  out of scope for v1 (right hand uses presence + distance + height only).
- Optional live-tweakable reverb size via an AudioWorklet Freeverb — only if fixed-IR
  reverb feels limiting.
