### Task 3: Discrete debounce + hysteresis

**Files:**
- Create: `src/smoothing/debounce.js`
- Test: `tests/debounce.test.js`

**Interfaces:**
- Produces: `class Debounced` â€” `constructor(framesToConfirm=4, initial=null)`, `push(value) â†’ committedValue` (commits only after the same value appears `framesToConfirm` times in a row).
- Produces: `class Hysteresis` â€” `constructor(enter, exit, initial=false)` (requires `exit <= enter`), `update(x) â†’ boolean`.

- [ ] **Step 1: Write the failing test** â€” `tests/debounce.test.js`

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
Expected: FAIL â€” module not found.

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

