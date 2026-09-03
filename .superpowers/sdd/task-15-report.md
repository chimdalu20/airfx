# Task 15 Report: Robustness — Permissions, Secure Context, Lost-Tracking Hold, Low-FPS, Mic Verification

**Date:** 2026-06-20
**Branch:** `implementation`
**Commit:** `17fe87f` — feat: robustness (secure context, mic verify, lost-tracking hold, FPS)

---

## What Was Done

### Step 1 — Secure-context + API guard (top of `start()`)
Inserted verbatim from brief at the very top of the `try {}` block in `start()`, before the `getUserMedia` call:
```js
if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
  throw new Error('Camera/mic need HTTPS or localhost. Serve over a secure origin.');
}
```
The `catch (e)` block already renders `startError` — so this throw surfaces cleanly as "Could not start: Error – Camera/mic need HTTPS…" in the UI without any additional plumbing.

### Step 2 — Mic-constraints verification (after `audioStream` is obtained)
Inserted immediately after the `getUserMedia` call (lines 51–55 in final file):
```js
const ms = audioStream.getAudioTracks()[0].getSettings();
if (ms.echoCancellation || ms.noiseSuppression || ms.autoGainControl) {
  document.getElementById('warn').textContent =
    '🎧 Use headphones. (Browser kept echo/noise processing on – headphones still fix it.)';
}
```
This fulfils the global-constraints requirement to verify mic constraints via `track.getSettings()` and warn accordingly.

### Step 3 — FPS counter inside `camera.start` callback
Inserted after `latestRaw = frame;` (lines 100–104 in final file), verbatim from brief:
```js
// FPS sampling
window.__airfx_fps = window.__airfx_fps || { last: frame.tMs, n: 0, fps: 0 };
const F = window.__airfx_fps;
F.n++;
if (frame.tMs - F.last > 1000) { F.fps = F.n; F.n = 0; F.last = frame.tMs; if (F.fps < 15) console.warn('Low FPS:', F.fps); }
```
Uses `window.__airfx_fps` so it's accessible from DevTools for inspection.

### Step 4 — Lost-tracking hold (NOTE, no code change)
Confirmed by reading `makeHandPipeline`: the returned closure keeps `lastNorm` across calls (closure variable), only updating it when `obs` is non-null. The Hysteresis with separate `PRESENCE.enter` / `PRESENCE.exit` thresholds means `present` flips to `false` only after the exit threshold — so `out.heightNorm` / `out.distanceNorm` keep their last filtered values during the hold period. The audio engine's `active` flag therefore drops cleanly with no snap. No code change required — the behaviour was already correct.

### Step 5 — Manual verification (DEFERRED)
Cannot run headlessly. Three scenarios to verify in a browser:
- **Deny mic** → `startError` shows "Could not start: NotAllowedError – ..."
- **Plain-HTTP LAN** → `startError` shows "Could not start: Error – Camera/mic need HTTPS or localhost. Serve over a secure origin."
- **Hand leaves frame** → effect dims, knob holds at last value, no audio jump.

---

## Automated Verification Results

| Check | Result |
|---|---|
| `node --check src/main.js` | Exit 0 (syntax OK) |
| `npm test` (38 tests) | 38 pass / 0 fail |

---

## Self-Review

- **Secure-context guard placement:** Inside `try {}`, before `getUserMedia` — the throw is caught by the existing `catch (e)` and rendered to `#startError`. Correct.
- **Mic verify placement:** Immediately after `audioStream` is assigned; before `AudioContext` creation. No risk of accessing a null stream here.
- **FPS counter placement:** First thing in the `camera.start` callback after `latestRaw = frame;`. Does not interfere with the signal pipeline (`leftPipe`, `rightPipe`, `engine.apply`, etc.) — it's read-only access to `frame.tMs`.
- **Existing wiring intact:** All three insertions are additive. The control loop, calibration, recording, panic-mute, and overlay paths are unchanged.
- **Lost-tracking hold:** Confirmed working by code review of `makeHandPipeline` (no code change needed).

---

## Concerns

- **Step 5 (manual live tests) DEFERRED** — headless environment cannot deny browser permissions, serve plain HTTP, or observe audio behaviour. Must be verified manually in Chrome/Edge before shipping.
- The `#warn` element is assumed present in `index.html` (referenced by `document.getElementById('warn')`). If it is absent the `getSettings` warning silently no-ops (no throw). This should be confirmed in the HTML during manual verification.
