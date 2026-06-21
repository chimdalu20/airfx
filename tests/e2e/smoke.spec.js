import { test, expect } from '@playwright/test';

test('rack renders and a dial rotates from a snapshot', async ({ page }) => {
  await page.goto('http://localhost:8000');
  await expect(page.locator('#startBtn')).toBeVisible();

  // Inject the rack directly (no camera/mic in CI) and drive it with a snapshot.
  // A max filter cutoff (12000 Hz -> display 1.0) should fill the value arc to 75/100 (270deg).
  const dash = await page.evaluate(async () => {
    const { createControlsPanel } = await import('/src/ui/controls-panel.js');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const panel = createControlsPanel(root);
    panel.update({
      filter: { cutoff: 12000, q: 1 },
      reverb: { wet: 1.3, active: true },
      delay: { mix: 0.5, time: 0.28, feedback: 0.55, active: true },
      tremolo: { rate: 12, depth: 1, active: true },
    });
    return root.querySelector('.knob[data-k="filter.cutoff"] .arc').style.strokeDasharray;
  });
  expect(dash).toContain('75');
});

// Regression: the `.overlay { display: grid }` rule used to tie with and defeat the
// [hidden] attribute, so the start screen never hid and covered the whole app.
test('start screen actually hides when its hidden attribute is set', async ({ page }) => {
  await page.goto('http://localhost:8000');
  await expect(page.locator('#startScreen')).toBeVisible();
  await page.evaluate(() => { document.getElementById('startScreen').hidden = true; });
  await expect(page.locator('#startScreen')).toBeHidden();
});
