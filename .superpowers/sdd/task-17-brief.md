### Task 17: Presets + on-hardware checklist + production notes

**Files:**
- Modify: `src/config.js` (export named presets), `src/main.js` (preset selector)
- Create: `docs/superpowers/CHECKLIST.md`

**Interfaces:**
- Produces: `PRESETS` â€” named overrides of effect ranges; `applyPreset(name)` swaps the active config-derived ranges. (Kept simple: presets adjust `REVERB.wetMax`, `DELAY.*`, `TREMOLO.*` via a mutable `active` object.)

- [ ] **Step 1: Add presets to `src/config.js`**

Append:

```js
export const PRESETS = {
  Subtle:  { reverbWetMax: 0.5, delayFeedbackMax: 0.35, tremoloDepthMax: 0.6 },
  Lush:    { reverbWetMax: 0.9, delayFeedbackMax: 0.55, tremoloDepthMax: 1.0 },
  Extreme: { reverbWetMax: 1.0, delayFeedbackMax: 0.85, tremoloDepthMax: 1.0 },
};
```

- [ ] **Step 2: Apply a preset in `src/main.js`**

Add a `<select id="preset">` to the `.actions` div in `index.html`:

```html
        <select id="preset"><option>Lush</option><option>Subtle</option><option>Extreme</option></select>
```

In `main.js`, import and apply (mutating the config objects the mapping reads):

```js
import { PRESETS, REVERB, DELAY, TREMOLO } from './config.js';

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  REVERB.wetMax = p.reverbWetMax;
  DELAY.feedbackMax = p.delayFeedbackMax;
  TREMOLO.depthMax = p.tremoloDepthMax;
}
```

Wire the selector inside `start()`:

```js
    const presetSel = document.getElementById('preset');
    applyPreset(presetSel.value);
    presetSel.addEventListener('change', () => applyPreset(presetSel.value));
```

- [ ] **Step 3: Create `docs/superpowers/CHECKLIST.md`**

```markdown
# AirFX â€” On-Hardware Verification Checklist

Run before calling a release done (desktop Chrome/Edge, headphones on):

- [ ] Start gate: click Start â†’ camera + mic prompts â†’ app shows, voice passes through clean (no howl).
- [ ] Latency feels like an expressive sweep, not a tight trigger (expected; ~80â€“200 ms gestureâ†’sound).
- [ ] Left 1 finger â†’ reverb engages + knob lights/moves. 2 fingers â†’ delay engages too.
- [ ] Left hand height sweeps the Filter cutoff knob audibly (brightâ†”dark).
- [ ] Left hand distance changes reverb amount (further = wetter).
- [ ] Right hand present â†’ tremolo; height = rate, distance = depth; wobble audible.
- [ ] Calibrate flow improves reach; persists across reload.
- [ ] Record â†’ Stop downloads the processed take; it plays back with effects.
- [ ] Mute (panic) silences instantly.
- [ ] Hand leaves frame â†’ effect dims, knob holds, no audio jump.
- [ ] Lighting: works in bright even light; degrades gracefully in dim light (no crash).
- [ ] Low-end laptop: FPS â‰¥ ~20, audio stays glitch-free; console shows no errors.
- [ ] Production: served over HTTPS; MediaPipe model + WASM self-hosted; version pinned to 0.10.35.
```

- [ ] **Step 4: Run all unit tests once more**

Run: `npm test`
Expected: PASS (math, one-euro, debounce, landmarks, profile, mapping, knob-geometry, synthetic-source, controls-panel).

- [ ] **Step 5: Commit**

```bash
git add src/config.js index.html src/main.js docs/superpowers/CHECKLIST.md
git commit -m "feat: presets + on-hardware verification checklist"
```

---

