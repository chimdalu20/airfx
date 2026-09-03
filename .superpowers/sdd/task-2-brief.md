### Task 2: One Euro Filter (signal smoothing)

**Files:**
- Create: `src/smoothing/one-euro.js`
- Test: `tests/one-euro.test.js`

**Interfaces:**
- Produces: `class OneEuroFilter` with constructor `({ minCutoff=1.0, beta=0.0, dCutoff=1.0 })` and `filter(value, timestampMs) â†’ number`. First call returns the input verbatim (initialization).

- [ ] **Step 1: Write the failing test** â€” `tests/one-euro.test.js`

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
Expected: FAIL â€” module not found.

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

