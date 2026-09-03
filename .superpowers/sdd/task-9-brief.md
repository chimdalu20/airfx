### Task 9: Gesture sources (synthetic + camera) and the Signals pipeline

> `synthetic-source.js` is partly node-testable; `camera-source.js` is browser-only.

**Files:**
- Create: `src/gestures/synthetic-source.js`, `src/gestures/camera-source.js`
- Modify: `src/main.js` (wire a source â†’ calibration â†’ smoothing â†’ mapping â†’ engine)
- Test: `tests/synthetic-source.test.js`

**Interfaces:**
- Produces:
  - `class SyntheticGestureSource` â€” `constructor(fn)`, `sample(tMs) â†’ RawFrame`, `start(onFrame, intervalMs=33)`, `stop()`.
  - `class CameraGestureSource` â€” `constructor(videoEl)`, `async init()`, `start(onFrame)`, `stop()`. Emits `RawFrame`.
  - `createSignalPipeline(getProfile) â†’ (rawFrame) â†’ Signals` â€” applies calibration + smoothing + debounce/hysteresis. (Added to `main.js` or a small helper; here kept in `main.js`.)
- Consumes: `applyCalibration` (Task 5), `OneEuroFilter` (Task 2), `Debounced`/`Hysteresis` (Task 3), `landmarks.js` (Task 4), config.

- [ ] **Step 1: Write the failing test** â€” `tests/synthetic-source.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyntheticGestureSource } from '../src/gestures/synthetic-source.js';

test('sample() returns whatever the fn produces', () => {
  const frame = { tMs: 0, left: { fingers: 2, height: 0.5, size: 0.3, confidence: 1 }, right: null };
  const src = new SyntheticGestureSource(() => frame);
  assert.deepEqual(src.sample(100), frame);
});

test('fn receives the timestamp', () => {
  const src = new SyntheticGestureSource((t) => ({ tMs: t, left: null, right: null }));
  assert.equal(src.sample(123).tMs, 123);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/synthetic-source.test.js`
Expected: FAIL â€” module not found.

- [ ] **Step 3: Implement `src/gestures/synthetic-source.js`**

```js
export class SyntheticGestureSource {
  constructor(fn) { this.fn = fn; this.timer = null; }
  sample(tMs) { return this.fn(tMs); }
  start(onFrame, intervalMs = 33) {
    let t = 0;
    this.timer = setInterval(() => { t += intervalMs; onFrame(this.fn(t)); }, intervalMs);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/synthetic-source.test.js`
Expected: PASS.

- [ ] **Step 5: Implement `src/gestures/camera-source.js`**

```js
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { countExtendedFingers, handHeight, handSize } from './landmarks.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

export class CameraGestureSource {
  constructor(videoEl) { this.video = videoEl; this.landmarker = null; this.running = false; }

  async init() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
    this.video.srcObject = stream;
    await this.video.play();
    const vision = await FilesetResolver.forVisionTasks(WASM);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    // Warm up (first inference costs hundreds of ms).
    this.landmarker.detectForVideo(this.video, performance.now());
  }

  start(onFrame) {
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      const tMs = performance.now();
      const res = this.landmarker.detectForVideo(this.video, tMs);
      onFrame(this._toRawFrame(res, tMs));
      if ('requestVideoFrameCallback' in this.video) this.video.requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    };
    if ('requestVideoFrameCallback' in this.video) this.video.requestVideoFrameCallback(loop);
    else requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.landmarker) { this.landmarker.close(); this.landmarker = null; }
    const s = this.video.srcObject;
    if (s) s.getTracks().forEach((t) => t.stop());
  }

  _toRawFrame(res, tMs) {
    const frame = { tMs, left: null, right: null, _landmarks: res.landmarks || [] };
    const hands = res.landmarks || [];
    const handed = res.handedness || [];
    for (let i = 0; i < hands.length; i++) {
      const lm = hands[i];
      const label = handed[i]?.[0]?.categoryName || 'Right';
      const conf = handed[i]?.[0]?.score ?? 1;
      const obs = { fingers: countExtendedFingers(lm, label), height: handHeight(lm), size: handSize(lm), confidence: conf };
      if (label === 'Left') frame.left = obs; else frame.right = obs;
    }
    return frame;
  }
}
```

- [ ] **Step 6: Add the Signals pipeline to `src/main.js`**

Add near the top (after imports), and add the imports:

```js
import { applyCalibration, DEFAULT_PROFILE } from './calibration/profile.js';
import { OneEuroFilter } from './smoothing/one-euro.js';
import { Debounced, Hysteresis } from './smoothing/debounce.js';
import { mapSignalsToSnapshot } from './mapping/mapping.js';
import { SMOOTH, DEBOUNCE, PRESENCE } from './config.js';

function makeHandPipeline(side, getProfile) {
  const heightF = new OneEuroFilter(SMOOTH);
  const distF = new OneEuroFilter(SMOOTH);
  const fingers = new Debounced(DEBOUNCE.fingerFrames, 0);
  const presence = new Hysteresis(PRESENCE.enter, PRESENCE.exit, false);
  let lastNorm = { heightNorm: 0, distanceNorm: 0 };
  return (obs, tMs) => {
    const present = presence.update(obs ? obs.confidence : 0);
    if (obs) {
      const cal = getProfile()[side];
      const raw = applyCalibration({ height: obs.height, size: obs.size }, cal);
      lastNorm = {
        heightNorm: heightF.filter(raw.heightNorm, tMs),
        distanceNorm: distF.filter(raw.distanceNorm, tMs),
      };
    }
    const out = { present, heightNorm: lastNorm.heightNorm, distanceNorm: lastNorm.distanceNorm };
    if (side === 'left') out.fingers = present ? fingers.push(obs ? obs.fingers : 0) : 0;
    return out;
  };
}

function createSignalPipeline(getProfile) {
  const left = makeHandPipeline('left', getProfile);
  const right = makeHandPipeline('right', getProfile);
  return (frame) => ({
    left: left(frame.left, frame.tMs),
    right: right(frame.right, frame.tMs),
  });
}
```

- [ ] **Step 7: Verify the pipeline compiles via a quick synthetic run (manual, browser console)**

Temporarily, at the end of `start()` in `main.js`, add:

```js
const profile = () => DEFAULT_PROFILE;
const toSignals = createSignalPipeline(profile);
const synth = new (await import('./gestures/synthetic-source.js')).SyntheticGestureSource(
  (t) => ({ tMs: t, left: { fingers: 2, height: 0.8, size: 0.4, confidence: 1 }, right: { fingers: 0, height: 0.6, size: 0.3, confidence: 1 } })
);
synth.start((frame) => engine.apply(mapSignalsToSnapshot(toSignals(frame))));
```

Run: `npm run serve`, open the app **with headphones**, click Start.
Expected: your voice now has reverb + delay (2 fingers simulated) and tremolo (right hand present). No errors. **Remove this temporary block before the next task's commit** (it's replaced by real wiring in Task 13).

- [ ] **Step 8: Commit**

```bash
git add src/gestures/synthetic-source.js src/gestures/camera-source.js src/main.js tests/synthetic-source.test.js
git commit -m "feat: gesture sources + calibration/smoothing signal pipeline"
```

---

