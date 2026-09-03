# Task 17 Report — Presets + On-Hardware Checklist + Production Notes

## Status: DONE

## Commit
SHA: 97b6ade  
Subject: `feat: presets + on-hardware verification checklist`  
Files changed: 4 (36 insertions, 1 deletion)

---

## Changes Applied

### 1. `src/config.js` — PRESETS export appended
Appended verbatim after the existing `KNOB` export:
```js
export const PRESETS = {
  Subtle:  { reverbWetMax: 0.5, delayFeedbackMax: 0.35, tremoloDepthMax: 0.6 },
  Lush:    { reverbWetMax: 0.9, delayFeedbackMax: 0.55, tremoloDepthMax: 1.0 },
  Extreme: { reverbWetMax: 1.0, delayFeedbackMax: 0.85, tremoloDepthMax: 1.0 },
};
```

### 2. `index.html` — `<select id="preset">` added to `.actions` div
Added verbatim as a fourth child of `.actions`, after the existing three buttons:
```html
<select id="preset"><option>Lush</option><option>Subtle</option><option>Extreme</option></select>
```

### 3. `src/main.js` — Three changes
- **Import line** extended: `SMOOTH, DEBOUNCE, PRESENCE` → `SMOOTH, DEBOUNCE, PRESENCE, PRESETS, REVERB, DELAY, TREMOLO`
- **`applyPreset(name)` function** inserted after `setProfile` export — mutates `REVERB.wetMax`, `DELAY.feedbackMax`, `TREMOLO.depthMax`
- **Selector wiring** in `start()`: reads `presetSel.value`, calls `applyPreset` on load and on `change` event — placed before `window.__airfx` assignment, after `calibrateBtn` listener

### 4. `docs/superpowers/CHECKLIST.md` — Created (new file + directory)
Directory `docs/superpowers/` created. Checklist written verbatim from brief (13 checkbox items covering: start gate, latency feel, finger→effect activation, filter sweep, reverb distance, tremolo, calibration persistence, recording, panic mute, hand-exit, lighting, low-end perf, production HTTPS+self-host).

---

## Verification

| Check | Result |
|---|---|
| `node --check src/config.js` | OK |
| `node --check src/main.js` | OK |
| `npm test` | 38/38 PASS (0 fail, 0 skip) |
| Existing wiring untouched | Confirmed — control loop, calibration, recording, panic all intact |
| Preset wiring additive | Confirmed — `applyPreset` only mutates config object properties; no existing `start()` logic removed |

---

## Self-Review Checklist

- [x] `PRESETS` appended to `src/config.js` (not inserted mid-file)
- [x] `<select id="preset">` with Lush/Subtle/Extreme options inside `.actions` div
- [x] `applyPreset` mutates `REVERB.wetMax`, `DELAY.feedbackMax`, `TREMOLO.depthMax`
- [x] Selector wired with initial `applyPreset(presetSel.value)` + `change` listener in `start()`
- [x] `CHECKLIST.md` created at `docs/superpowers/CHECKLIST.md`
- [x] Existing control loop / calibration / recording / robustness wiring in `main.js` NOT disturbed
- [x] Commit targeted: exactly `src/config.js index.html src/main.js docs/superpowers/CHECKLIST.md`
- [x] Trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Concerns
None. All changes are additive; the mutation approach works because `mapping.js` and `knob-geometry.js` read `REVERB`/`DELAY`/`TREMOLO` properties live from the same shared module objects.
