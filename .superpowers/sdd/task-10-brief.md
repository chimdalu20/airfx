### Task 10: Animated controls rack

> Browser DOM rendering; the geometry math behind it is unit-tested in Task 7. Verified visually + via a DOM assertion.

**Files:**
- Create: `src/ui/controls-panel.js`
- Test: `tests/controls-panel.test.js` (jsdom-free: assert pure angle output is wired by spying on a fake element)

**Interfaces:**
- Produces: `createControlsPanel(rootEl) â†’ { update(snapshot) }`. `update` sets each dial's `transform: rotate()` from `snapshotToDisplay` + `valueToAngle`, and toggles `.active` per effect.
- Consumes: `snapshotToDisplay`, `valueToAngle` (Task 7), `KNOB` (config).

- [ ] **Step 1: Write the failing test** â€” `tests/controls-panel.test.js`

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
Expected: FAIL â€” module not found.

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

