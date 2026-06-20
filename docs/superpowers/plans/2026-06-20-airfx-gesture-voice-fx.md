# AirFX — Hand-Gesture Voice Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, client-side web app that applies reverb/delay/tremolo/filter to the live microphone voice, controlled by webcam hand gestures, with an on-screen rack of knobs that animate in real time as the hands move.

**Architecture:** Vanilla JS ES modules, no framework, no build step. A swappable gesture source (camera+MediaPipe, or synthetic) emits raw per-hand observations → calibration normalizes them → One Euro smoothing + debounce/hysteresis → pure mapping → a parameter snapshot consumed by both a native Web Audio graph and a pure-view controls rack. Audio uses native Web Audio nodes only (they run off the main thread, so no AudioWorklet is needed); MediaPipe inference runs on the main thread for v1.

**Tech Stack:** HTML/CSS/JS (ES modules), `@mediapipe/tasks-vision` 0.10.35 (HandLandmarker, GPU delegate), native Web Audio API, One Euro Filter, `MediaRecorder`. Tests via Node's built-in runner (`node --test`), no external test framework. Optional Playwright smoke test.

## Global Constraints

Every task implicitly includes these (values copied from the spec):

- **No build step / no framework.** Plain ES modules loaded via `<script type="module">` and an importmap. Dependencies via CDN in dev; self-host MediaPipe model + WASM for production.
- **Library versions (pin exactly):** `@mediapipe/tasks-vision@0.10.35`. Avoid deprecated `@mediapipe/hands` and the stale TF.js hand-pose wrapper.
- **Hand tracking config:** `HandLandmarker`, `delegate: 'GPU'`, `runningMode: 'VIDEO'`, `numHands: 2`.
- **Audio:** native Web Audio nodes only (no AudioWorklet, no `ScriptProcessorNode`). Apply every parameter change via `AudioParam.setTargetAtTime` (never assign `.value` per frame).
- **Mic constraints:** request `{ echoCancellation:false, noiseSuppression:false, autoGainControl:false }` and verify with `track.getSettings()`.
- **Safety:** master limiter (DynamicsCompressor) + panic-mute; headphone-use warning; clamp delay feedback < 0.9.
- **Platform:** desktop-first (Chrome/Edge primary). Window-resize-safe; not phone-tuned. Secure context required (`localhost` for dev, HTTPS for prod).
- **UX model:** every gesture mapping is a continuous *sweep*, not a tight trigger (latency ~40–100 ms audio, ~80–200 ms gesture→sound).
- **Tooling:** Node 18+ (for `node --test`). Run tests with `npm test`. Run the app with `npm run serve` then open `http://localhost:8000`.
- **Commits:** end every commit message with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omitted from the short commands below for brevity — add it).

## File Structure

```
airfx/
  index.html                      # app shell, importmap, layout, Start gate
  styles.css                      # all styling (incl. resize-safe layout)
  package.json                    # type:module, test + serve scripts (no deps)
  .gitignore
  README.md
  src/
    config.js                     # all numeric ranges/curves/thresholds
    math.js                       # clamp, lerp, normalize, logMap, linMap (pure)
    smoothing/
      one-euro.js                 # OneEuroFilter (pure)
      debounce.js                 # Debounced + Hysteresis (pure)
    gestures/
      landmarks.js                # countExtendedFingers, handHeight, handSize (pure)
      synthetic-source.js         # SyntheticGestureSource (pure sample() + loop)
      camera-source.js            # CameraGestureSource (MediaPipe, browser)
    calibration/
      profile.js                  # DEFAULT_PROFILE, applyCalibration (pure)
      calibration-ui.js           # capture flow + localStorage (browser)
    mapping/
      mapping.js                  # signals → param snapshot (pure)
    audio/
      reverb-ir.js                # generateImpulseResponse (browser)
      audio-engine.js             # native Web Audio graph + apply(snapshot) (browser)
      recorder.js                 # MediaRecorder wrapper (browser)
    ui/
      knob-geometry.js            # valueToAngle, snapshotToDisplay (pure)
      controls-panel.js           # animated rack, update(snapshot) (browser)
      meters.js                   # live signal meters (browser)
      overlay.js                  # landmark overlay canvas (browser)
    main.js                       # bootstrap + control loop + Start gate (browser)
  tests/
    math.test.js
    one-euro.test.js
    debounce.test.js
    landmarks.test.js
    profile.test.js
    mapping.test.js
    knob-geometry.test.js
  docs/superpowers/...            # spec + this plan
```

**Shared data shapes (referenced across tasks):**

- `RawFrame` (emitted by every gesture source):
  ```js
  {
    tMs: number,
    left:  null | { fingers: number, height: number, size: number, confidence: number },
    right: null | { fingers: number, height: number, size: number, confidence: number }
  }
  // height: 0 (bottom of frame) .. 1 (top); size: apparent hand size (bigger = closer)
  ```
- `Signals` (after calibration + smoothing, consumed by mapping):
  ```js
  {
    left:  { present: boolean, fingers: number, heightNorm: number, distanceNorm: number },
    right: { present: boolean, heightNorm: number, distanceNorm: number }
  }
  ```
- `Snapshot` (produced by mapping; consumed by audio-engine AND controls-panel):
  ```js
  {
    filter:  { cutoff: number, q: number },
    reverb:  { wet: number, active: boolean },
    delay:   { mix: number, time: number, feedback: number, active: boolean },
    tremolo: { rate: number, depth: number, active: boolean }
  }
  ```

---

### Task 1: Project scaffold + math utilities

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `src/math.js`
- Test: `tests/math.test.js`

**Interfaces:**
- Produces: `clamp(x,lo,hi)`, `lerp(a,b,t)`, `normalize(x,min,max)→0..1 clamped`, `logMap(t,min,max)` (geometric), `linMap(t,min,max)` (linear, t clamped).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "airfx",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "serve": "npx --yes serve -l 8000 ."
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 3: Create `README.md`**

```markdown
# AirFX

Hand-gesture-controlled voice effects in the browser. Vanilla JS, no build step.

## Develop
- `npm test` — run unit tests (Node 18+, built-in runner).
- `npm run serve` — serve at http://localhost:8000 (use headphones!).

Open in desktop Chrome/Edge, click **Start**, allow camera + mic.

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the build plan.
```

- [ ] **Step 4: Write the failing test** — `tests/math.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, normalize, logMap, linMap } from '../src/math.js';

test('clamp bounds the value', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('lerp interpolates', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('normalize maps and clamps to 0..1', () => {
  assert.equal(normalize(5, 0, 10), 0.5);
  assert.equal(normalize(-5, 0, 10), 0);
  assert.equal(normalize(50, 0, 10), 1);
  assert.equal(normalize(3, 5, 5), 0); // degenerate range
});

test('logMap is geometric across the range', () => {
  assert.equal(logMap(0, 80, 12000), 80);
  assert.equal(logMap(1, 80, 12000), 12000);
  assert.ok(Math.abs(logMap(0.5, 80, 12000) - Math.sqrt(80 * 12000)) < 1e-6);
});

test('linMap clamps t then interpolates', () => {
  assert.equal(linMap(0.5, 0, 10), 5);
  assert.equal(linMap(2, 0, 10), 10);
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `../src/math.js`.

- [ ] **Step 6: Implement `src/math.js`**

```js
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const normalize = (x, min, max) =>
  max === min ? 0 : clamp((x - min) / (max - min), 0, 1);
export const logMap = (t, min, max) => min * Math.pow(max / min, clamp(t, 0, 1));
export const linMap = (t, min, max) => lerp(min, max, clamp(t, 0, 1));
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all math tests).

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore README.md src/math.js tests/math.test.js
git commit -m "feat: scaffold project + math utilities"
```

---

### Task 2: One Euro Filter (signal smoothing)

**Files:**
- Create: `src/smoothing/one-euro.js`
- Test: `tests/one-euro.test.js`

**Interfaces:**
- Produces: `class OneEuroFilter` with constructor `({ minCutoff=1.0, beta=0.0, dCutoff=1.0 })` and `filter(value, timestampMs) → number`. First call returns the input verbatim (initialization).

- [ ] **Step 1: Write the failing test** — `tests/one-euro.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OneEuroFilter } from '../src/smoothing/one-euro.js';

test('first sample returns the input', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  assert.equal(f.filter(0.42, 0), 0.42);
});

test('constant input converges to the constant', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  let out;
  for (let i = 0; i < 50; i++) out = f.filter(5, i * 33);
  assert.ok(Math.abs(out - 5) < 1e-3);
});

test('a step does not jump fully in one frame (lag present)', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  for (let i = 0; i < 10; i++) f.filter(0, i * 33);
  const out = f.filter(10, 10 * 33);
  assert.ok(out > 0 && out < 10);
});

test('reduces jitter vs raw alternating signal', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  const outs = [];
  for (let i = 0; i < 40; i++) outs.push(f.filter(i % 2 === 0 ? 0.4 : 0.6, i * 33));
  const tail = outs.slice(20);
  const range = Math.max(...tail) - Math.min(...tail);
  assert.ok(range < 0.2); // raw range is 0.2; smoothed must be smaller
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/one-euro.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/smoothing/one-euro.js`**

```js
const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

class LowPass {
  constructor() { this.s = null; this.raw = null; }
  has() { return this.raw !== null; }
  last() { return this.raw; }
  filter(x, a) {
    this.s = this.s === null ? x : a * x + (1 - a) * this.s;
    this.raw = x;
    return this.s;
  }
}

export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.lastTime = null;
  }
  filter(value, timestampMs) {
    let dt = 1 / 30;
    if (this.lastTime !== null && timestampMs > this.lastTime) {
      dt = (timestampMs - this.lastTime) / 1000;
    }
    this.lastTime = timestampMs;
    const prev = this.x.has() ? this.x.last() : value;
    const dValue = (value - prev) / dt;
    const edValue = this.dx.filter(dValue, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edValue);
    return this.x.filter(value, alpha(cutoff, dt));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/one-euro.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/smoothing/one-euro.js tests/one-euro.test.js
git commit -m "feat: One Euro Filter for landmark smoothing"
```

---

### Task 3: Discrete debounce + hysteresis

**Files:**
- Create: `src/smoothing/debounce.js`
- Test: `tests/debounce.test.js`

**Interfaces:**
- Produces: `class Debounced` — `constructor(framesToConfirm=4, initial=null)`, `push(value) → committedValue` (commits only after the same value appears `framesToConfirm` times in a row).
- Produces: `class Hysteresis` — `constructor(enter, exit, initial=false)` (requires `exit <= enter`), `update(x) → boolean`.

- [ ] **Step 1: Write the failing test** — `tests/debounce.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Debounced, Hysteresis } from '../src/smoothing/debounce.js';

test('Debounced commits only after N identical pushes', () => {
  const d = new Debounced(3, 0);
  assert.equal(d.push(1), 0);
  assert.equal(d.push(1), 0);
  assert.equal(d.push(1), 1); // 3rd identical -> commit
});

test('Debounced flicker resets the streak', () => {
  const d = new Debounced(3, 0);
  d.push(1); d.push(1);
  assert.equal(d.push(2), 0); // changed candidate, streak resets, not committed
  d.push(2); 
  assert.equal(d.push(2), 2);
});

test('Hysteresis uses separate enter/exit thresholds', () => {
  const h = new Hysteresis(0.6, 0.4, false);
  assert.equal(h.update(0.5), false); // below enter
  assert.equal(h.update(0.65), true); // crosses enter
  assert.equal(h.update(0.5), true);  // between exit and enter -> holds
  assert.equal(h.update(0.3), false); // below exit
});

test('Hysteresis rejects exit > enter', () => {
  assert.throws(() => new Hysteresis(0.4, 0.6));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/debounce.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/smoothing/debounce.js`**

```js
export class Debounced {
  constructor(framesToConfirm = 4, initial = null) {
    this.n = framesToConfirm;
    this.committed = initial;
    this.candidate = initial;
    this.count = 0;
  }
  push(value) {
    if (value === this.candidate) {
      this.count++;
    } else {
      this.candidate = value;
      this.count = 1;
    }
    if (this.count >= this.n) this.committed = this.candidate;
    return this.committed;
  }
}

export class Hysteresis {
  constructor(enter, exit, initial = false) {
    if (exit > enter) throw new Error('Hysteresis: exit must be <= enter');
    this.enter = enter;
    this.exit = exit;
    this.state = initial;
  }
  update(x) {
    if (this.state) {
      if (x <= this.exit) this.state = false;
    } else if (x >= this.enter) {
      this.state = true;
    }
    return this.state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/debounce.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/smoothing/debounce.js tests/debounce.test.js
git commit -m "feat: debounce + hysteresis for discrete gesture states"
```

---

### Task 4: Landmark feature extraction

**Files:**
- Create: `src/gestures/landmarks.js`
- Test: `tests/landmarks.test.js`

**Interfaces:**
- Produces:
  - `countExtendedFingers(landmarks, handedness) → 0..5` (`landmarks`: array of 21 `{x,y,z}`; `handedness`: `'Left'|'Right'`, assuming a mirrored selfie image).
  - `handHeight(landmarks) → 0..1` (1 = top of frame).
  - `handSize(landmarks) → number` (wrist↔middle-MCP distance; bigger = closer).
- Consumes: nothing (pure).

- [ ] **Step 1: Write the failing test** — `tests/landmarks.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countExtendedFingers, handHeight, handSize } from '../src/gestures/landmarks.js';

// Helper: 21 neutral points, all folded (tip.y == pip.y), thumb folded.
function blankHand() {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

test('counts one extended finger (index only)', () => {
  const lm = blankHand();
  lm[8] = { x: 0.5, y: 0.2, z: 0 };  // index tip high
  lm[6] = { x: 0.5, y: 0.4, z: 0 };  // index pip lower
  assert.equal(countExtendedFingers(lm, 'Right'), 1);
});

test('counts two extended fingers (index + middle)', () => {
  const lm = blankHand();
  lm[8] = { x: 0.5, y: 0.2, z: 0 }; lm[6] = { x: 0.5, y: 0.4, z: 0 };
  lm[12] = { x: 0.5, y: 0.2, z: 0 }; lm[10] = { x: 0.5, y: 0.4, z: 0 };
  assert.equal(countExtendedFingers(lm, 'Right'), 2);
});

test('handHeight inverts y (top of frame = 1)', () => {
  const lm = blankHand();
  lm[9] = { x: 0.5, y: 0.3, z: 0 };
  assert.ok(Math.abs(handHeight(lm) - 0.7) < 1e-9);
});

test('handSize is wrist-to-middle-MCP distance', () => {
  const lm = blankHand();
  lm[0] = { x: 0.5, y: 0.8, z: 0 };
  lm[9] = { x: 0.5, y: 0.5, z: 0 };
  assert.ok(Math.abs(handSize(lm) - 0.3) < 1e-9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/landmarks.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/gestures/landmarks.js`**

```js
// Non-thumb fingers as [tipIndex, pipIndex].
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]];

export function fingerExtended(lm, tip, pip) {
  return lm[tip].y < lm[pip].y; // smaller y = higher on screen = extended (image origin top-left)
}

export function countExtendedFingers(lm, handedness) {
  let count = 0;
  for (const [tip, pip] of FINGERS) if (fingerExtended(lm, tip, pip)) count++;
  // Thumb: compare tip(4) x vs IP(3) x. Mirror-selfie: Right hand thumb extends to the left.
  const thumbExtended = handedness === 'Right' ? lm[4].x < lm[3].x : lm[4].x > lm[3].x;
  if (thumbExtended) count++;
  return count;
}

export const handHeight = (lm) => 1 - lm[9].y;
export const handSize = (lm) => Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/landmarks.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gestures/landmarks.js tests/landmarks.test.js
git commit -m "feat: landmark feature extraction (fingers, height, size)"
```

---

### Task 5: Calibration profile + normalization

**Files:**
- Create: `src/calibration/profile.js`
- Test: `tests/profile.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_PROFILE` — `{ left:{sizeNear,sizeFar,heightLow,heightHigh}, right:{...} }`.
  - `applyCalibration({ height, size }, calOneHand) → { heightNorm, distanceNorm }`. `distanceNorm`: 0 = close (large size), 1 = far (small size).
- Consumes: `normalize` from Task 1.

- [ ] **Step 1: Write the failing test** — `tests/profile.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, applyCalibration } from '../src/calibration/profile.js';

const cal = { sizeNear: 0.45, sizeFar: 0.15, heightLow: 0.1, heightHigh: 0.9 };

test('distanceNorm: near=0, far=1, mid=0.5', () => {
  assert.equal(applyCalibration({ height: 0.5, size: 0.45 }, cal).distanceNorm, 0);
  assert.equal(applyCalibration({ height: 0.5, size: 0.15 }, cal).distanceNorm, 1);
  assert.ok(Math.abs(applyCalibration({ height: 0.5, size: 0.30 }, cal).distanceNorm - 0.5) < 1e-9);
});

test('heightNorm: low=0, high=1', () => {
  assert.equal(applyCalibration({ height: 0.1, size: 0.3 }, cal).heightNorm, 0);
  assert.equal(applyCalibration({ height: 0.9, size: 0.3 }, cal).heightNorm, 1);
});

test('values clamp outside the calibrated range', () => {
  assert.equal(applyCalibration({ height: 1.0, size: 0.6 }, cal).distanceNorm, 0); // bigger than near
  assert.equal(applyCalibration({ height: 0.0, size: 0.3 }, cal).heightNorm, 0);
});

test('DEFAULT_PROFILE has both hands', () => {
  assert.ok(DEFAULT_PROFILE.left && DEFAULT_PROFILE.right);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/profile.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/calibration/profile.js`**

```js
import { normalize } from '../math.js';

const DEFAULT_HAND = { sizeNear: 0.45, sizeFar: 0.15, heightLow: 0.1, heightHigh: 0.9 };

export const DEFAULT_PROFILE = {
  left: { ...DEFAULT_HAND },
  right: { ...DEFAULT_HAND },
};

export function applyCalibration({ height, size }, cal) {
  const heightNorm = normalize(height, cal.heightLow, cal.heightHigh);
  const distanceNorm = 1 - normalize(size, cal.sizeFar, cal.sizeNear);
  return { heightNorm, distanceNorm };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/profile.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/calibration/profile.js tests/profile.test.js
git commit -m "feat: calibration profile + per-user normalization"
```

---

### Task 6: Config + gesture→parameter mapping

**Files:**
- Create: `src/config.js`, `src/mapping/mapping.js`
- Test: `tests/mapping.test.js`

**Interfaces:**
- Produces: `mapSignalsToSnapshot(signals) → Snapshot` (shapes in File Structure). Pure.
- Consumes: `Signals` (Task 9/14 build these), `logMap`/`linMap` (Task 1), config constants.

- [ ] **Step 1: Create `src/config.js`**

```js
export const FILTER = { min: 80, max: 12000, q: 1.0 };
export const REVERB = { wetMax: 0.9, heightFloor: 0.3 };
export const DELAY = { time: 0.28, feedbackMin: 0.15, feedbackMax: 0.55, mixMin: 0.0, mixMax: 0.5 };
export const TREMOLO = { rateMin: 0.1, rateMax: 12, depthMax: 1.0 };
export const SMOOTH = { minCutoff: 1.2, beta: 0.6, dCutoff: 1.0 };
export const DEBOUNCE = { fingerFrames: 4 };
export const PRESENCE = { enter: 0.6, exit: 0.4 }; // hand-confidence hysteresis
export const PARAM = { timeConstant: 0.03 };        // setTargetAtTime smoothing
export const KNOB = { sweepDeg: 270 };
```

- [ ] **Step 2: Write the failing test** — `tests/mapping.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSignalsToSnapshot } from '../src/mapping/mapping.js';

const base = {
  left: { present: true, fingers: 1, heightNorm: 0.5, distanceNorm: 0.5 },
  right: { present: false, heightNorm: 0.5, distanceNorm: 0.5 },
};

test('left height drives filter cutoff (log) across the range', () => {
  const lo = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 0 } });
  const hi = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1 } });
  assert.ok(Math.abs(lo.filter.cutoff - 80) < 1e-6);
  assert.ok(Math.abs(hi.filter.cutoff - 12000) < 1e-6);
});

test('1 finger = reverb active, delay inactive', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { ...base.left, fingers: 1 } });
  assert.equal(s.reverb.active, true);
  assert.equal(s.delay.active, false);
});

test('2 fingers = reverb + delay active', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { ...base.left, fingers: 2 } });
  assert.equal(s.reverb.active, true);
  assert.equal(s.delay.active, true);
});

test('left distance scales reverb wet (master intensity)', () => {
  const near = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1, distanceNorm: 0 } });
  const far = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1, distanceNorm: 1 } });
  assert.ok(far.reverb.wet > near.reverb.wet);
});

test('left absent opens the filter and bypasses reverb/delay', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { present: false, fingers: 0, heightNorm: 0, distanceNorm: 0 } });
  assert.ok(Math.abs(s.filter.cutoff - 12000) < 1e-6);
  assert.equal(s.reverb.active, false);
  assert.equal(s.delay.active, false);
});

test('right present = tremolo; height=rate, distance=depth', () => {
  const s = mapSignalsToSnapshot({ ...base, right: { present: true, heightNorm: 1, distanceNorm: 1 } });
  assert.equal(s.tremolo.active, true);
  assert.ok(Math.abs(s.tremolo.rate - 12) < 1e-6);
  assert.ok(Math.abs(s.tremolo.depth - 1) < 1e-6);
});

test('right absent = tremolo inactive, depth 0', () => {
  const s = mapSignalsToSnapshot(base);
  assert.equal(s.tremolo.active, false);
  assert.equal(s.tremolo.depth, 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/mapping.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/mapping/mapping.js`**

```js
import { logMap, linMap, clamp } from '../math.js';
import { FILTER, REVERB, DELAY, TREMOLO } from '../config.js';

export function mapSignalsToSnapshot(signals) {
  const L = signals.left;
  const R = signals.right;

  // Filter: left height -> cutoff (log). Absent left hand -> fully open (bypass).
  const cutoff = L.present ? logMap(L.heightNorm, FILTER.min, FILTER.max) : FILTER.max;

  // Reverb: character from height, master intensity from distance.
  const reverbActive = L.present && L.fingers >= 1;
  const heightChar = linMap(L.heightNorm, REVERB.heightFloor, 1.0);
  const wet = reverbActive ? clamp(REVERB.wetMax * L.distanceNorm * heightChar, 0, REVERB.wetMax) : 0;

  // Delay: engaged at 2 fingers; distance -> mix + feedback.
  const delayActive = L.present && L.fingers >= 2;
  const mix = delayActive ? linMap(L.distanceNorm, DELAY.mixMin, DELAY.mixMax) : 0;
  const feedback = delayActive ? linMap(L.distanceNorm, DELAY.feedbackMin, DELAY.feedbackMax) : 0;

  // Tremolo: right presence engages; height -> rate (log), distance -> depth.
  const tremoloActive = R.present;
  const rate = logMap(R.heightNorm, TREMOLO.rateMin, TREMOLO.rateMax);
  const depth = tremoloActive ? linMap(R.distanceNorm, 0, TREMOLO.depthMax) : 0;

  return {
    filter: { cutoff, q: FILTER.q },
    reverb: { wet, active: reverbActive },
    delay: { mix, time: DELAY.time, feedback, active: delayActive },
    tremolo: { rate, depth, active: tremoloActive },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/mapping.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/mapping/mapping.js tests/mapping.test.js
git commit -m "feat: config + gesture-to-parameter mapping"
```

---

### Task 7: Knob geometry (pure view math)

**Files:**
- Create: `src/ui/knob-geometry.js`
- Test: `tests/knob-geometry.test.js`

**Interfaces:**
- Produces:
  - `valueToAngle(value0to1, sweepDeg=270) → degrees` centered on 0 (e.g. -135..+135).
  - `snapshotToDisplay(snapshot) → { filter, reverb, delay, tremolo }` where each is `{ <knob>: 0..1 }` normalized for display (inverse of the mapping curves).
- Consumes: `Snapshot` (Task 6), config, `clamp`.

- [ ] **Step 1: Write the failing test** — `tests/knob-geometry.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueToAngle, snapshotToDisplay } from '../src/ui/knob-geometry.js';

test('valueToAngle centers and spans the sweep', () => {
  assert.equal(valueToAngle(0, 270), -135);
  assert.equal(valueToAngle(0.5, 270), 0);
  assert.equal(valueToAngle(1, 270), 135);
});

test('valueToAngle clamps out-of-range input', () => {
  assert.equal(valueToAngle(-1, 270), -135);
  assert.equal(valueToAngle(2, 270), 135);
});

test('snapshotToDisplay normalizes cutoff back to 0..1 (log inverse)', () => {
  const lo = snapshotToDisplay({ filter: { cutoff: 80, q: 1 }, reverb: { wet: 0, active: false }, delay: { mix: 0, time: 0.28, feedback: 0, active: false }, tremolo: { rate: 0.1, depth: 0, active: false } });
  const hi = snapshotToDisplay({ filter: { cutoff: 12000, q: 1 }, reverb: { wet: 0.9, active: true }, delay: { mix: 0.5, time: 0.28, feedback: 0.55, active: true }, tremolo: { rate: 12, depth: 1, active: true } });
  assert.ok(Math.abs(lo.filter.cutoff - 0) < 1e-6);
  assert.ok(Math.abs(hi.filter.cutoff - 1) < 1e-6);
  assert.ok(Math.abs(hi.reverb.wet - 1) < 1e-6);
  assert.ok(Math.abs(hi.tremolo.depth - 1) < 1e-6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/knob-geometry.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/knob-geometry.js`**

```js
import { clamp } from '../math.js';
import { FILTER, REVERB, DELAY, TREMOLO } from '../config.js';

export function valueToAngle(value, sweepDeg = 270) {
  const v = clamp(value, 0, 1);
  return -sweepDeg / 2 + v * sweepDeg;
}

const logNorm = (v, min, max) =>
  v <= min ? 0 : v >= max ? 1 : Math.log(v / min) / Math.log(max / min);
const linNorm = (v, min, max) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1));

export function snapshotToDisplay(s) {
  return {
    filter: { cutoff: logNorm(s.filter.cutoff, FILTER.min, FILTER.max) },
    reverb: { wet: linNorm(s.reverb.wet, 0, REVERB.wetMax), active: s.reverb.active },
    delay: {
      mix: linNorm(s.delay.mix, DELAY.mixMin, DELAY.mixMax),
      feedback: linNorm(s.delay.feedback, DELAY.feedbackMin, DELAY.feedbackMax),
      active: s.delay.active,
    },
    tremolo: {
      rate: logNorm(s.tremolo.rate, TREMOLO.rateMin, TREMOLO.rateMax),
      depth: linNorm(s.tremolo.depth, 0, TREMOLO.depthMax),
      active: s.tremolo.active,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/knob-geometry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/knob-geometry.js tests/knob-geometry.test.js
git commit -m "feat: knob geometry + snapshot-to-display normalization"
```

---

### Task 8: App shell, Start gate, mic passthrough + limiter

> Browser task — verified by running the app (Web Audio cannot be unit-tested in Node). Use **headphones**.

**Files:**
- Create: `index.html`, `styles.css`, `src/audio/reverb-ir.js`, `src/audio/audio-engine.js`, `src/main.js`

**Interfaces:**
- Produces:
  - `generateImpulseResponse(ctx, {seconds, decay}) → AudioBuffer`.
  - `createAudioEngine(ctx, stream) → { apply(snapshot), recorderStream, panic(), unmute(), monitorStream }`.
- Consumes: `PARAM` (Task 6 config). `apply` consumes a `Snapshot` (Task 6).

- [ ] **Step 1: Create `src/audio/reverb-ir.js`**

```js
export function generateImpulseResponse(ctx, { seconds = 2.0, decay = 2.5 } = {}) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}
```

- [ ] **Step 2: Create `src/audio/audio-engine.js`**

```js
import { PARAM } from '../config.js';
import { generateImpulseResponse } from './reverb-ir.js';

export function createAudioEngine(ctx, stream) {
  const source = ctx.createMediaStreamSource(stream);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 12000;
  filter.Q.value = 1.0;

  // Tremolo: LFO -> depthGain -> tremGain.gain; base gain centers the swing.
  const tremGain = ctx.createGain();
  tremGain.gain.value = 1.0;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(tremGain.gain);
  lfo.start();

  // Delay with feedback.
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0;

  // Reverb (fixed IR; wet gain is the live control).
  const convolver = ctx.createConvolver();
  convolver.buffer = generateImpulseResponse(ctx, { seconds: 2.0, decay: 2.5 });
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;

  const dry = ctx.createGain();
  dry.gain.value = 1.0;

  const master = ctx.createGain();
  master.gain.value = 1.0;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  const dest = ctx.createMediaStreamDestination();

  // Routing: source -> filter -> tremGain -> {dry, delay, reverb} -> master -> limiter -> out + recorder
  source.connect(filter);
  filter.connect(tremGain);
  tremGain.connect(dry).connect(master);
  tremGain.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayWet).connect(master);
  tremGain.connect(convolver).connect(reverbWet).connect(master);
  master.connect(limiter);
  limiter.connect(ctx.destination);
  limiter.connect(dest);

  const tc = PARAM.timeConstant;

  function apply(snap) {
    const t = ctx.currentTime;
    filter.frequency.setTargetAtTime(snap.filter.cutoff, t, tc);
    filter.Q.setTargetAtTime(snap.filter.q, t, tc);
    reverbWet.gain.setTargetAtTime(snap.reverb.active ? snap.reverb.wet : 0, t, tc);
    delay.delayTime.setTargetAtTime(snap.delay.time, t, tc);
    delayWet.gain.setTargetAtTime(snap.delay.active ? snap.delay.mix : 0, t, tc);
    feedback.gain.setTargetAtTime(snap.delay.active ? Math.min(snap.delay.feedback, 0.89) : 0, t, tc);
    lfo.frequency.setTargetAtTime(snap.tremolo.rate, t, tc);
    const depth = snap.tremolo.active ? snap.tremolo.depth : 0;
    lfoDepth.gain.setTargetAtTime(depth / 2, t, tc);
    tremGain.gain.setTargetAtTime(1 - depth / 2, t, tc);
  }

  function panic() { master.gain.setTargetAtTime(0, ctx.currentTime, 0.01); }
  function unmute() { master.gain.setTargetAtTime(1, ctx.currentTime, 0.05); }

  return { apply, panic, unmute, recorderStream: dest.stream };
}
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AirFX — Hand-Gesture Voice Effects</title>
  <link rel="stylesheet" href="styles.css" />
  <script type="importmap">
  { "imports": { "@mediapipe/tasks-vision": "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs" } }
  </script>
</head>
<body>
  <header>
    <h1>AirFX</h1>
    <div id="warn" class="warn">🎧 Use headphones — speakers cause feedback howl.</div>
  </header>

  <div id="startScreen" class="overlay">
    <button id="startBtn">Start (allow camera + mic)</button>
    <p id="startError" class="error" hidden></p>
  </div>

  <main id="app" hidden>
    <section class="stage">
      <video id="video" playsinline muted></video>
      <canvas id="overlay"></canvas>
    </section>
    <aside class="side">
      <div id="meters"></div>
      <div id="rack"></div>
      <div class="actions">
        <button id="calibrateBtn">Calibrate</button>
        <button id="recordBtn">● Record</button>
        <button id="panicBtn" class="danger">Mute</button>
      </div>
    </aside>
  </main>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `styles.css`**

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #14151a; color: #e8e8ea; }
header { display: flex; gap: 1rem; align-items: center; padding: .6rem 1rem; flex-wrap: wrap; }
h1 { font-size: 1.1rem; margin: 0; }
.warn { background: #5a4500; color: #ffe08a; padding: .3rem .6rem; border-radius: 6px; font-size: .85rem; }
.overlay { position: fixed; inset: 0; display: grid; place-content: center; background: #14151a; z-index: 10; }
#startBtn { font-size: 1.1rem; padding: .8rem 1.4rem; border: 0; border-radius: 10px; background: #4f7cff; color: #fff; cursor: pointer; }
.error { color: #ff8a8a; }
main { display: flex; gap: 1rem; padding: 1rem; flex-wrap: wrap; }
.stage { position: relative; flex: 1 1 480px; min-width: 0; }
video, #overlay { width: 100%; height: auto; border-radius: 10px; transform: scaleX(-1); display: block; }
#overlay { position: absolute; inset: 0; }
.side { flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 1rem; }
#rack { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: .8rem; }
.fx { background: #1e2027; border-radius: 10px; padding: .8rem; opacity: .45; transition: opacity .15s; }
.fx.active { opacity: 1; outline: 1px solid #4f7cff; }
.fx h3 { margin: 0 0 .5rem; font-size: .9rem; }
.knobs { display: flex; gap: .8rem; flex-wrap: wrap; }
.knob { text-align: center; font-size: .7rem; }
.dial { width: 52px; height: 52px; border-radius: 50%; background: #2b2e38; position: relative; margin: 0 auto .25rem; }
.dial::after { content: ""; position: absolute; left: 50%; top: 6px; width: 3px; height: 18px; background: #8fb0ff; transform-origin: 50% 20px; transform: translateX(-50%) rotate(0deg); }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
button { background: #2b2e38; color: #e8e8ea; border: 0; border-radius: 8px; padding: .5rem .8rem; cursor: pointer; }
button.danger { background: #6a2330; }
#meters { font-size: .8rem; line-height: 1.5; background: #1e2027; border-radius: 10px; padding: .6rem; }
```

- [ ] **Step 5: Create `src/main.js` (Start gate + mic passthrough only for now)**

```js
import { createAudioEngine } from './audio/audio-engine.js';

const startBtn = document.getElementById('startBtn');
const startError = document.getElementById('startError');

async function start() {
  startError.hidden = true;
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    const engine = createAudioEngine(ctx, audioStream);
    // Idle passthrough: filter open, no effects.
    engine.apply({
      filter: { cutoff: 12000, q: 1 },
      reverb: { wet: 0, active: false },
      delay: { mix: 0, time: 0.28, feedback: 0, active: false },
      tremolo: { rate: 5, depth: 0, active: false },
    });
    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;
    window.__airfx = { ctx, engine }; // dev handle for next tasks
    const settings = audioStream.getAudioTracks()[0].getSettings();
    console.log('mic settings (verify AEC/NS/AGC off):', settings);
  } catch (e) {
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} — ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
```

- [ ] **Step 6: Run the app and verify (manual)**

Run: `npm run serve` then open `http://localhost:8000` in Chrome **with headphones on**.
Expected:
- Click **Start** → browser prompts for microphone.
- After allowing, you hear your own voice through the headphones (passthrough), no howl.
- Console logs `mic settings` with `echoCancellation:false` (or a note if the platform refused).
- No console errors.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css src/audio/reverb-ir.js src/audio/audio-engine.js src/main.js
git commit -m "feat: app shell, Start gate, mic passthrough with limiter"
```

---

### Task 9: Gesture sources (synthetic + camera) and the Signals pipeline

> `synthetic-source.js` is partly node-testable; `camera-source.js` is browser-only.

**Files:**
- Create: `src/gestures/synthetic-source.js`, `src/gestures/camera-source.js`
- Modify: `src/main.js` (wire a source → calibration → smoothing → mapping → engine)
- Test: `tests/synthetic-source.test.js`

**Interfaces:**
- Produces:
  - `class SyntheticGestureSource` — `constructor(fn)`, `sample(tMs) → RawFrame`, `start(onFrame, intervalMs=33)`, `stop()`.
  - `class CameraGestureSource` — `constructor(videoEl)`, `async init()`, `start(onFrame)`, `stop()`. Emits `RawFrame`.
  - `createSignalPipeline(getProfile) → (rawFrame) → Signals` — applies calibration + smoothing + debounce/hysteresis. (Added to `main.js` or a small helper; here kept in `main.js`.)
- Consumes: `applyCalibration` (Task 5), `OneEuroFilter` (Task 2), `Debounced`/`Hysteresis` (Task 3), `landmarks.js` (Task 4), config.

- [ ] **Step 1: Write the failing test** — `tests/synthetic-source.test.js`

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
Expected: FAIL — module not found.

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

### Task 10: Animated controls rack

> Browser DOM rendering; the geometry math behind it is unit-tested in Task 7. Verified visually + via a DOM assertion.

**Files:**
- Create: `src/ui/controls-panel.js`
- Test: `tests/controls-panel.test.js` (jsdom-free: assert pure angle output is wired by spying on a fake element)

**Interfaces:**
- Produces: `createControlsPanel(rootEl) → { update(snapshot) }`. `update` sets each dial's `transform: rotate()` from `snapshotToDisplay` + `valueToAngle`, and toggles `.active` per effect.
- Consumes: `snapshotToDisplay`, `valueToAngle` (Task 7), `KNOB` (config).

- [ ] **Step 1: Write the failing test** — `tests/controls-panel.test.js`

This test avoids a DOM library by passing a minimal fake root whose `querySelector`/element API records transforms.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDialAngles } from '../src/ui/controls-panel.js';

test('computeDialAngles maps a full snapshot to centered angles', () => {
  const angles = computeDialAngles({
    filter: { cutoff: 12000, q: 1 },
    reverb: { wet: 0.9, active: true },
    delay: { mix: 0.5, time: 0.28, feedback: 0.55, active: true },
    tremolo: { rate: 12, depth: 1, active: true },
  });
  assert.ok(Math.abs(angles.filter.cutoff - 135) < 1e-6);   // max -> +135
  assert.ok(Math.abs(angles.reverb.wet - 135) < 1e-6);
  assert.ok(Math.abs(angles.tremolo.depth - 135) < 1e-6);
  assert.equal(angles.delay.active, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/controls-panel.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ui/controls-panel.js`**

```js
import { snapshotToDisplay, valueToAngle } from './knob-geometry.js';
import { KNOB } from '../config.js';

// Pure: snapshot -> per-knob angles (degrees) + active flags. Unit-tested.
export function computeDialAngles(snapshot) {
  const d = snapshotToDisplay(snapshot);
  const a = (v) => valueToAngle(v, KNOB.sweepDeg);
  return {
    filter: { cutoff: a(d.filter.cutoff), active: true },
    reverb: { wet: a(d.reverb.wet), active: d.reverb.active },
    delay: { mix: a(d.delay.mix), feedback: a(d.delay.feedback), active: d.delay.active },
    tremolo: { rate: a(d.tremolo.rate), depth: a(d.tremolo.depth), active: d.tremolo.active },
  };
}

const LAYOUT = [
  { key: 'filter', title: 'Filter', knobs: [['cutoff', 'Cutoff']] },
  { key: 'reverb', title: 'Reverb', knobs: [['wet', 'Amount']] },
  { key: 'delay', title: 'Delay', knobs: [['mix', 'Mix'], ['feedback', 'Feedback']] },
  { key: 'tremolo', title: 'Tremolo', knobs: [['rate', 'Rate'], ['depth', 'Depth']] },
];

export function createControlsPanel(rootEl) {
  const dials = {};
  const groups = {};
  for (const fx of LAYOUT) {
    const card = document.createElement('div');
    card.className = 'fx';
    card.innerHTML = `<h3>${fx.title}</h3><div class="knobs"></div>`;
    const knobsEl = card.querySelector('.knobs');
    for (const [knobKey, label] of fx.knobs) {
      const k = document.createElement('div');
      k.className = 'knob';
      k.innerHTML = `<div class="dial"></div><span>${label}</span>`;
      knobsEl.appendChild(k);
      dials[`${fx.key}.${knobKey}`] = k.querySelector('.dial');
    }
    rootEl.appendChild(card);
    groups[fx.key] = card;
  }

  function update(snapshot) {
    const angles = computeDialAngles(snapshot);
    for (const fx of LAYOUT) {
      groups[fx.key].classList.toggle('active', !!angles[fx.key].active);
      for (const [knobKey] of fx.knobs) {
        const dial = dials[`${fx.key}.${knobKey}`];
        dial.style.setProperty('--angle', `${angles[fx.key][knobKey]}deg`);
        const after = `rotate(${angles[fx.key][knobKey]}deg)`;
        dial.style.transform = ''; // dial itself stays; pointer is the ::after pseudo
        dial.dataset.angle = angles[fx.key][knobKey].toFixed(1);
      }
    }
  }

  return { update };
}
```

- [ ] **Step 4: Update `styles.css` so the dial pointer reads `--angle`**

Replace the `.dial::after` rule from Task 8 with:

```css
.dial::after {
  content: "";
  position: absolute;
  left: 50%; top: 6px;
  width: 3px; height: 18px;
  background: #8fb0ff;
  transform-origin: 50% 20px;
  transform: translateX(-50%) rotate(var(--angle, 0deg));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/controls-panel.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/controls-panel.js styles.css tests/controls-panel.test.js
git commit -m "feat: animated controls rack (knobs reflect snapshot)"
```

---

### Task 11: Live meters + landmark overlay

> Browser-only; verified visually.

**Files:**
- Create: `src/ui/meters.js`, `src/ui/overlay.js`

**Interfaces:**
- Produces:
  - `createMeters(rootEl) → { update(signals) }` — shows per-hand present/fingers/height/distance.
  - `createOverlay(canvasEl, videoEl) → { draw(landmarksArray) }` — draws hand points over the (mirrored) video.

- [ ] **Step 1: Implement `src/ui/meters.js`**

```js
export function createMeters(rootEl) {
  rootEl.innerHTML = `
    <div><b>Left</b> <span id="mL">—</span></div>
    <div><b>Right</b> <span id="mR">—</span></div>`;
  const mL = rootEl.querySelector('#mL');
  const mR = rootEl.querySelector('#mR');
  const fmt = (h) => h.present
    ? `fingers:${h.fingers ?? '-'} height:${h.heightNorm.toFixed(2)} dist:${h.distanceNorm.toFixed(2)}`
    : 'not detected';
  return {
    update(signals) {
      mL.textContent = fmt(signals.left);
      mR.textContent = fmt({ ...signals.right, fingers: signals.right.fingers });
    },
  };
}
```

- [ ] **Step 2: Implement `src/ui/overlay.js`**

```js
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export function createOverlay(canvas, video) {
  const ctx = canvas.getContext('2d');
  function draw(hands) {
    canvas.width = video.videoWidth || canvas.clientWidth;
    canvas.height = video.videoHeight || canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#4f7cff';
    ctx.fillStyle = '#8fb0ff';
    ctx.lineWidth = 2;
    for (const lm of hands) {
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
        ctx.stroke();
      }
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return { draw };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/meters.js src/ui/overlay.js
git commit -m "feat: live meters + landmark overlay"
```

---

### Task 12: Wire the full control loop (camera → signals → mapping → audio + rack + meters + overlay)

> Browser-only; the heart of the app. Verified end-to-end with the camera.

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: everything from Tasks 5–11.

- [ ] **Step 1: Replace `src/main.js` `start()` with the full wiring**

```js
import { createAudioEngine } from './audio/audio-engine.js';
import { CameraGestureSource } from './gestures/camera-source.js';
import { applyCalibration, DEFAULT_PROFILE } from './calibration/profile.js';
import { OneEuroFilter } from './smoothing/one-euro.js';
import { Debounced, Hysteresis } from './smoothing/debounce.js';
import { mapSignalsToSnapshot } from './mapping/mapping.js';
import { createControlsPanel } from './ui/controls-panel.js';
import { createMeters } from './ui/meters.js';
import { createOverlay } from './ui/overlay.js';
import { SMOOTH, DEBOUNCE, PRESENCE } from './config.js';

let profile = DEFAULT_PROFILE;
export const getProfile = () => profile;
export const setProfile = (p) => { profile = p; };

function makeHandPipeline(side) {
  const heightF = new OneEuroFilter(SMOOTH);
  const distF = new OneEuroFilter(SMOOTH);
  const fingers = new Debounced(DEBOUNCE.fingerFrames, 0);
  const presence = new Hysteresis(PRESENCE.enter, PRESENCE.exit, false);
  let lastNorm = { heightNorm: 0, distanceNorm: 0 };
  return (obs, tMs) => {
    const present = presence.update(obs ? obs.confidence : 0);
    if (obs) {
      const raw = applyCalibration({ height: obs.height, size: obs.size }, profile[side]);
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

const startBtn = document.getElementById('startBtn');
const startError = document.getElementById('startError');

async function start() {
  startError.hidden = true;
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    const engine = createAudioEngine(ctx, audioStream);

    const video = document.getElementById('video');
    const camera = new CameraGestureSource(video);
    await camera.init();

    const rack = createControlsPanel(document.getElementById('rack'));
    const meters = createMeters(document.getElementById('meters'));
    const overlay = createOverlay(document.getElementById('overlay'), video);

    const leftPipe = makeHandPipeline('left');
    const rightPipe = makeHandPipeline('right');

    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;

    camera.start((frame) => {
      const signals = { left: leftPipe(frame.left, frame.tMs), right: rightPipe(frame.right, frame.tMs) };
      const snapshot = mapSignalsToSnapshot(signals);
      engine.apply(snapshot);
      rack.update(snapshot);
      meters.update(signals);
      overlay.draw(frame._landmarks || []);
    });

    document.getElementById('panicBtn').addEventListener('click', () => engine.panic());
    window.__airfx = { ctx, engine, camera, setProfile };
  } catch (e) {
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} — ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
```

- [ ] **Step 2: Verify end-to-end (manual, with camera + headphones)**

Run: `npm run serve`, open `http://localhost:8000`, headphones on, click Start, allow camera + mic.
Expected:
- Overlay draws your hand skeleton; meters update live.
- **Left hand:** 1 finger → reverb knob lights + moves; 2 fingers → delay also lights; raise/lower hand → Filter cutoff knob sweeps; move hand toward/away → reverb amount changes.
- **Right hand:** present → Tremolo lights; height → rate knob; distance → depth knob; you hear the wobble.
- Knobs visibly animate as you move. **Mute** button silences instantly.
- No console errors; audio stays glitch-free while tracking runs.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: full control loop wiring (camera -> audio + animated rack)"
```

---

### Task 13: Calibration UI + persistence

> Browser-only.

**Files:**
- Create: `src/calibration/calibration-ui.js`
- Modify: `src/main.js` (load saved profile on start; wire Calibrate button)

**Interfaces:**
- Produces:
  - `loadProfile() → profile|null`, `saveProfile(profile)` (localStorage key `airfx.calibration`).
  - `runCalibration({ getLatestRaw }) → Promise<profile>` — guided 4-step capture (near/far size, low/high height) per hand using the latest raw observation.
- Consumes: `DEFAULT_PROFILE` (Task 5).

- [ ] **Step 1: Implement `src/calibration/calibration-ui.js`**

```js
import { DEFAULT_PROFILE } from './profile.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// getLatestRaw() must return the most recent RawFrame.
export async function runCalibration({ getLatestRaw }) {
  const profile = structuredClone(DEFAULT_PROFILE);
  const steps = [
    ['Hold your LEFT hand CLOSE, then click OK', 'left', 'size', 'sizeNear'],
    ['Hold your LEFT hand FAR, then click OK', 'left', 'size', 'sizeFar'],
    ['Raise your LEFT hand HIGH, then click OK', 'left', 'height', 'heightHigh'],
    ['Lower your LEFT hand LOW, then click OK', 'left', 'height', 'heightLow'],
    ['Hold your RIGHT hand CLOSE, then click OK', 'right', 'size', 'sizeNear'],
    ['Hold your RIGHT hand FAR, then click OK', 'right', 'size', 'sizeFar'],
    ['Raise your RIGHT hand HIGH, then click OK', 'right', 'height', 'heightHigh'],
    ['Lower your RIGHT hand LOW, then click OK', 'right', 'height', 'heightLow'],
  ];
  for (const [prompt, side, field, target] of steps) {
    // eslint-disable-next-line no-alert
    window.alert(prompt);
    const raw = getLatestRaw();
    const obs = raw?.[side];
    if (obs) profile[side][target] = obs[field];
  }
  saveProfile(profile);
  return profile;
}
```

- [ ] **Step 2: Wire it into `src/main.js`**

Add the import at the top:

```js
import { loadProfile, saveProfile, runCalibration } from './calibration/calibration-ui.js';
```

In `start()`, after `await camera.init();`, load any saved profile and track the latest frame:

```js
    const saved = loadProfile();
    if (saved) profile = saved;
    let latestRaw = null;
```

Inside the `camera.start((frame) => { ... })` callback, set `latestRaw = frame;` as the first line. Then after wiring the panic button, add:

```js
    document.getElementById('calibrateBtn').addEventListener('click', async () => {
      profile = await runCalibration({ getLatestRaw: () => latestRaw });
    });
```

- [ ] **Step 3: Verify (manual)**

Run the app, click **Calibrate**, follow the 8 prompts moving your hands as instructed.
Expected: after calibration, distance/height controls use your personal range (reach full reverb at your "far", full filter at your "high"). Reload the page → calibration persists (no re-calibration needed).

- [ ] **Step 4: Commit**

```bash
git add src/calibration/calibration-ui.js src/main.js
git commit -m "feat: guided calibration + localStorage persistence"
```

---

### Task 14: Recording / export

> Browser-only.

**Files:**
- Create: `src/audio/recorder.js`
- Modify: `src/main.js` (wire Record button)

**Interfaces:**
- Produces: `createRecorder(stream) → { start(), stop()→Promise<Blob>, active }`.
- Consumes: `engine.recorderStream` (Task 8).

- [ ] **Step 1: Implement `src/audio/recorder.js`**

```js
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export function createRecorder(stream) {
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
  let rec = null;
  let chunks = [];
  return {
    start() {
      chunks = [];
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.start();
    },
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        rec.stop();
      });
    },
    get active() { return !!rec && rec.state === 'recording'; },
  };
}
```

- [ ] **Step 2: Wire it into `src/main.js`**

Add the import:

```js
import { createRecorder } from './audio/recorder.js';
```

In `start()`, after creating the engine, add and wire the button:

```js
    const recorder = createRecorder(engine.recorderStream);
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.addEventListener('click', async () => {
      if (!recorder.active) {
        recorder.start();
        recordBtn.textContent = '■ Stop';
        recordBtn.classList.add('danger');
      } else {
        const blob = await recorder.stop();
        recordBtn.textContent = '● Record';
        recordBtn.classList.remove('danger');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `airfx-take.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
```

- [ ] **Step 3: Verify (manual)**

Run the app, click **● Record**, sing with effects, click **■ Stop**.
Expected: a `.webm` (or `.mp4` on Safari) downloads containing the **processed** voice.

- [ ] **Step 4: Commit**

```bash
git add src/audio/recorder.js src/main.js
git commit -m "feat: record + export processed audio"
```

---

### Task 15: Robustness — permissions, secure context, lost-tracking hold, low-FPS, mic verification

> Browser-only hardening.

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add a secure-context + API guard at the top of `start()`**

```js
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera/mic need HTTPS or localhost. Serve over a secure origin.');
    }
```

- [ ] **Step 2: Verify mic constraints actually applied (warn if not)**

After getting `audioStream`, add:

```js
    const ms = audioStream.getAudioTracks()[0].getSettings();
    if (ms.echoCancellation || ms.noiseSuppression || ms.autoGainControl) {
      document.getElementById('warn').textContent =
        '🎧 Use headphones. (Browser kept echo/noise processing on — headphones still fix it.)';
    }
```

- [ ] **Step 3: Add an FPS counter + graceful note**

In the `camera.start` callback, append:

```js
      // FPS sampling
      window.__airfx_fps = window.__airfx_fps || { last: frame.tMs, n: 0, fps: 0 };
      const F = window.__airfx_fps;
      F.n++;
      if (frame.tMs - F.last > 1000) { F.fps = F.n; F.n = 0; F.last = frame.tMs; if (F.fps < 15) console.warn('Low FPS:', F.fps); }
```

- [ ] **Step 4: Confirm lost-tracking hold already works**

Note (no code change): `makeHandPipeline` keeps `lastNorm` when `obs` is null and the presence hysteresis flips `present` to false after the exit threshold, so a hand leaving frame holds its last continuous values and the effect's `active` flag drops cleanly — no snap. Verify by moving a hand out of frame: the knob holds, the effect group dims.

- [ ] **Step 5: Verify (manual)**

- Deny the mic permission → a clear error appears on the Start screen (not a silent failure).
- Serve over a LAN IP via plain HTTP → the secure-context error appears.
- Move a hand out of frame → its effect dims, knob holds, no audio jump.

- [ ] **Step 6: Commit**

```bash
git add src/main.js
git commit -m "feat: robustness (secure context, mic verify, lost-tracking hold, FPS)"
```

---

### Task 16: Optional Playwright UI smoke test

> Optional; adds one dev dependency. Skip if you want zero deps.

**Files:**
- Create: `tests/e2e/smoke.spec.js`
- Modify: `package.json` (add `test:e2e` script)

- [ ] **Step 1: Add the script to `package.json`**

```json
  "scripts": {
    "test": "node --test tests/",
    "serve": "npx --yes serve -l 8000 .",
    "test:e2e": "npx --yes playwright test tests/e2e"
  }
```

- [ ] **Step 2: Create `tests/e2e/smoke.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('rack renders and a dial rotates from a snapshot', async ({ page }) => {
  await page.goto('http://localhost:8000');
  await expect(page.locator('#startBtn')).toBeVisible();

  // Inject the rack directly (no camera/mic in CI) and drive it with a snapshot.
  const angle = await page.evaluate(async () => {
    const { createControlsPanel } = await import('/src/ui/controls-panel.js');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const panel = createControlsPanel(root);
    panel.update({
      filter: { cutoff: 12000, q: 1 },
      reverb: { wet: 0.9, active: true },
      delay: { mix: 0.5, time: 0.28, feedback: 0.55, active: true },
      tremolo: { rate: 12, depth: 1, active: true },
    });
    return root.querySelector('.dial').dataset.angle;
  });
  expect(Number(angle)).toBeCloseTo(135, 0);
});
```

- [ ] **Step 3: Run (with the dev server running in another shell)**

Run shell A: `npm run serve`
Run shell B: `npm run test:e2e`
Expected: PASS — the page loads, the rack renders, the filter dial reads ~135° for a max snapshot.

- [ ] **Step 4: Commit**

```bash
git add package.json tests/e2e/smoke.spec.js
git commit -m "test: Playwright smoke test for the controls rack"
```

---

### Task 17: Presets + on-hardware checklist + production notes

**Files:**
- Modify: `src/config.js` (export named presets), `src/main.js` (preset selector)
- Create: `docs/superpowers/CHECKLIST.md`

**Interfaces:**
- Produces: `PRESETS` — named overrides of effect ranges; `applyPreset(name)` swaps the active config-derived ranges. (Kept simple: presets adjust `REVERB.wetMax`, `DELAY.*`, `TREMOLO.*` via a mutable `active` object.)

- [ ] **Step 1: Add presets to `src/config.js`**

Append:

```js
export const PRESETS = {
  Subtle:  { reverbWetMax: 0.5, delayFeedbackMax: 0.35, tremoloDepthMax: 0.6 },
  Lush:    { reverbWetMax: 0.9, delayFeedbackMax: 0.55, tremoloDepthMax: 1.0 },
  Extreme: { reverbWetMax: 1.0, delayFeedbackMax: 0.85, tremoloDepthMax: 1.0 },
};
```

- [ ] **Step 2: Apply a preset in `src/main.js`**

Add a `<select id="preset">` to the `.actions` div in `index.html`:

```html
        <select id="preset"><option>Lush</option><option>Subtle</option><option>Extreme</option></select>
```

In `main.js`, import and apply (mutating the config objects the mapping reads):

```js
import { PRESETS, REVERB, DELAY, TREMOLO } from './config.js';

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  REVERB.wetMax = p.reverbWetMax;
  DELAY.feedbackMax = p.delayFeedbackMax;
  TREMOLO.depthMax = p.tremoloDepthMax;
}
```

Wire the selector inside `start()`:

```js
    const presetSel = document.getElementById('preset');
    applyPreset(presetSel.value);
    presetSel.addEventListener('change', () => applyPreset(presetSel.value));
```

- [ ] **Step 3: Create `docs/superpowers/CHECKLIST.md`**

```markdown
# AirFX — On-Hardware Verification Checklist

Run before calling a release done (desktop Chrome/Edge, headphones on):

- [ ] Start gate: click Start → camera + mic prompts → app shows, voice passes through clean (no howl).
- [ ] Latency feels like an expressive sweep, not a tight trigger (expected; ~80–200 ms gesture→sound).
- [ ] Left 1 finger → reverb engages + knob lights/moves. 2 fingers → delay engages too.
- [ ] Left hand height sweeps the Filter cutoff knob audibly (bright↔dark).
- [ ] Left hand distance changes reverb amount (further = wetter).
- [ ] Right hand present → tremolo; height = rate, distance = depth; wobble audible.
- [ ] Calibrate flow improves reach; persists across reload.
- [ ] Record → Stop downloads the processed take; it plays back with effects.
- [ ] Mute (panic) silences instantly.
- [ ] Hand leaves frame → effect dims, knob holds, no audio jump.
- [ ] Lighting: works in bright even light; degrades gracefully in dim light (no crash).
- [ ] Low-end laptop: FPS ≥ ~20, audio stays glitch-free; console shows no errors.
- [ ] Production: served over HTTPS; MediaPipe model + WASM self-hosted; version pinned to 0.10.35.
```

- [ ] **Step 4: Run all unit tests once more**

Run: `npm test`
Expected: PASS (math, one-euro, debounce, landmarks, profile, mapping, knob-geometry, synthetic-source, controls-panel).

- [ ] **Step 5: Commit**

```bash
git add src/config.js index.html src/main.js docs/superpowers/CHECKLIST.md
git commit -m "feat: presets + on-hardware verification checklist"
```

---

## Self-Review

**1. Spec coverage**
- Live mic FX chain (reverb/delay/tremolo/filter) → Tasks 6, 8, 12. ✓
- MediaPipe HandLandmarker 0.10.35, GPU, 2 hands → Task 9 (`camera-source.js`). ✓
- Left 1/2 fingers, height=tone(filter+reverb), distance=intensity → Task 6 mapping + tests. ✓
- Right presence/height=rate/distance=depth → Task 6 mapping + tests. ✓
- Distance via calibrated apparent-size (not worldLandmarks/z) → Tasks 4–5 (`handSize`, `applyCalibration`). ✓
- Mandatory calibration + persistence → Task 13. ✓
- One Euro smoothing + debounce/hysteresis → Tasks 2, 3, 12. ✓
- Native nodes, no AudioWorklet, setTargetAtTime → Task 8. ✓
- Headphones warning, limiter, panic, feedback clamp → Tasks 8, 12, 15. ✓
- Live animated rack reflecting snapshot → Tasks 7, 10, 12. ✓
- Recording/export → Task 14. ✓
- Robustness (secure context, mic verify, lost-tracking hold, low-FPS) → Task 15. ✓
- Testability via synthetic source + pure modules → Tasks 1–7, 9, 16. ✓
- Desktop-first, resize-safe, no build → Tasks 1, 8 (styles). ✓
- Presets + checklist → Task 17. ✓
- Web Worker inference is explicitly an "open/future" item in the spec (§ Threading: v1 main-thread); not a v1 task. ✓ (intentional, documented)

**2. Placeholder scan:** No "TBD/TODO/handle edge cases/similar to Task N" — every code step has full code; every run step has a command + expected result. ✓

**3. Type consistency:** `RawFrame` (`{tMs,left,right}`, each hand `{fingers,height,size,confidence}`) is produced by both sources (Task 9) and consumed by `makeHandPipeline` (Task 12). `Signals` (`{left:{present,fingers,heightNorm,distanceNorm}, right:{present,heightNorm,distanceNorm}}`) is produced by the pipeline (Task 12) and consumed by `mapSignalsToSnapshot` (Task 6). `Snapshot` is produced by Task 6 and consumed identically by `audio-engine.apply` (Task 8) and `controls-panel`/`snapshotToDisplay` (Tasks 7, 10). `applyCalibration`, `OneEuroFilter`, `Debounced`, `Hysteresis`, `valueToAngle`, `snapshotToDisplay`, `computeDialAngles`, `createAudioEngine`, `createControlsPanel`, `createRecorder` names are consistent across definition and use. ✓

No issues found that need fixing.
