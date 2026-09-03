### Task 4: Landmark feature extraction

**Files:**
- Create: `src/gestures/landmarks.js`
- Test: `tests/landmarks.test.js`

**Interfaces:**
- Produces:
  - `countExtendedFingers(landmarks, handedness) â†’ 0..5` (`landmarks`: array of 21 `{x,y,z}`; `handedness`: `'Left'|'Right'`, assuming a mirrored selfie image).
  - `handHeight(landmarks) â†’ 0..1` (1 = top of frame).
  - `handSize(landmarks) â†’ number` (wristâ†”middle-MCP distance; bigger = closer).
- Consumes: nothing (pure).

- [ ] **Step 1: Write the failing test** â€” `tests/landmarks.test.js`

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
Expected: FAIL â€” module not found.

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

