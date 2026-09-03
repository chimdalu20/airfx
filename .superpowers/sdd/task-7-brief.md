### Task 7: Knob geometry (pure view math)

**Files:**
- Create: `src/ui/knob-geometry.js`
- Test: `tests/knob-geometry.test.js`

**Interfaces:**
- Produces:
  - `valueToAngle(value0to1, sweepDeg=270) â†’ degrees` centered on 0 (e.g. -135..+135).
  - `snapshotToDisplay(snapshot) â†’ { filter, reverb, delay, tremolo }` where each is `{ <knob>: 0..1 }` normalized for display (inverse of the mapping curves).
- Consumes: `Snapshot` (Task 6), config, `clamp`.

- [ ] **Step 1: Write the failing test** â€” `tests/knob-geometry.test.js`

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
Expected: FAIL â€” module not found.

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

