### Task 6: Config + gestureâ†’parameter mapping

**Files:**
- Create: `src/config.js`, `src/mapping/mapping.js`
- Test: `tests/mapping.test.js`

**Interfaces:**
- Produces: `mapSignalsToSnapshot(signals) â†’ Snapshot` (shapes in File Structure). Pure.
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

- [ ] **Step 2: Write the failing test** â€” `tests/mapping.test.js`

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
Expected: FAIL â€” module not found.

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

