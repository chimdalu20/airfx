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
Expected: PASS â€” the page loads, the rack renders, the filter dial reads ~135Â° for a max snapshot.

- [ ] **Step 4: Commit**

```bash
git add package.json tests/e2e/smoke.spec.js
git commit -m "test: Playwright smoke test for the controls rack"
```

---

