### Task 5: Calibration profile + normalization

**Files:**
- Create: `src/calibration/profile.js`
- Test: `tests/profile.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_PROFILE` â€” `{ left:{sizeNear,sizeFar,heightLow,heightHigh}, right:{...} }`.
  - `applyCalibration({ height, size }, calOneHand) â†’ { heightNorm, distanceNorm }`. `distanceNorm`: 0 = close (large size), 1 = far (small size).
- Consumes: `normalize` from Task 1.

- [ ] **Step 1: Write the failing test** â€” `tests/profile.test.js`

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
Expected: FAIL â€” module not found.

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

