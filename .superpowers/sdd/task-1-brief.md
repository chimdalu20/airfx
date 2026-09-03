### Task 1: Project scaffold + math utilities

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `src/math.js`
- Test: `tests/math.test.js`

**Interfaces:**
- Produces: `clamp(x,lo,hi)`, `lerp(a,b,t)`, `normalize(x,min,max)â†’0..1 clamped`, `logMap(t,min,max)` (geometric), `linMap(t,min,max)` (linear, t clamped).

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
- `npm test` â€” run unit tests (Node 18+, built-in runner).
- `npm run serve` â€” serve at http://localhost:8000 (use headphones!).

Open in desktop Chrome/Edge, click **Start**, allow camera + mic.

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the build plan.
```

- [ ] **Step 4: Write the failing test** â€” `tests/math.test.js`

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
Expected: FAIL â€” cannot find module `../src/math.js`.

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

