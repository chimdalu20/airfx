# Task 10 Report — Animated Controls Rack

## Files Created / Modified

- **Created:** `src/ui/controls-panel.js` — exports `computeDialAngles` (pure) and `createControlsPanel(rootEl)` (DOM)
- **Created:** `tests/controls-panel.test.js` — TDD test for `computeDialAngles`
- **Modified:** `styles.css` — replaced `.dial::after` hard `rotate(0deg)` with `rotate(var(--angle, 0deg))`

## TDD RED/GREEN for `computeDialAngles`

- **RED:** `node --test tests/controls-panel.test.js` → `ERR_MODULE_NOT_FOUND` (module not yet created). Confirmed fail.
- **GREEN:** After implementing `src/ui/controls-panel.js`, same command → `✔ computeDialAngles maps a full snapshot to centered angles (1.43ms)`. Pass.

## `node --check` Result

`node --check src/ui/controls-panel.js` → exit 0, no errors. The `document` global reference does not cause a parse/syntax error (as expected — it's a runtime-only browser global).

## `npm test` Result

38 tests, 0 failures, 0 skipped. (Previous: 37 tests. New test added: +1.)

```
✔ computeDialAngles maps a full snapshot to centered angles (2.21ms)
... (37 prior tests all still passing)
ℹ tests 38
ℹ pass 38
ℹ fail 0
```

## Live Verification Deferred

`createControlsPanel` builds real DOM nodes using `document.createElement`. Since this environment is headless (no browser), DOM behavior is deferred to Task 12 (wiring in `src/main.js`) or a manual browser test at `http://localhost:8000`.

## Self-Review

- `update(snapshot)` calls `computeDialAngles(snapshot)`, then for each effect group:
  - `groups[fx.key].classList.toggle('active', !!angles[fx.key].active)` — correctly toggles `.active` class per effect.
  - For each knob dial: `dial.style.setProperty('--angle', `${...}deg`)` — sets `--angle` CSS variable; the `::after` pseudo-element reads it via `rotate(var(--angle, 0deg))` in `styles.css`.
  - `dial.dataset.angle` is also stamped for debugging.
- `computeDialAngles` delegates normalization to `snapshotToDisplay` (Task 7), then converts each 0–1 normalized value to degrees via `valueToAngle(v, KNOB.sweepDeg)`. At max input (cutoff=12000, wet=0.9, depth=1, rate=12), the result is `+135deg` (= 270/2), which matches all three test assertions.
- `filter.active` is hardcoded `true` per the brief (filter is always active).

## Concerns

None. Implementation is verbatim from the brief. The unused `after` variable on line 44 of `controls-panel.js` is present verbatim as written in the brief — it's benign dead code (the pointer is driven by the CSS variable, not an inline transform on the dial itself).

## Commit

SHA: `2629889` — `feat: animated controls rack (knobs reflect snapshot)`

---

## Dead-Code Cleanup (Follow-Up)

### Change
Removed two dead lines from the `update(snapshot)` function's `for (const [knobKey] of fx.knobs)` inner loop:
- Deleted: `const after = \`rotate(${angles[fx.key][knobKey]}deg)\`;` (line 49)
- Deleted: `dial.style.transform = ''; // dial itself stays; pointer is the ::after pseudo` (line 50)

Remaining loop body (lines 47–51):
```js
const dial = dials[`${fx.key}.${knobKey}`];
dial.style.setProperty('--angle', `${angles[fx.key][knobKey]}deg`);
dial.dataset.angle = angles[fx.key][knobKey].toFixed(1);
```

### Syntax Check
`node --check src/ui/controls-panel.js` → exit 0 ✅

### Test Suite
`npm test` → 38 tests, 38 pass, 0 fail ✅
- `computeDialAngles` test (covering dial angles) passes
- All 37 prior tests remain passing (no regressions)

### Commit
SHA: `86733c5` — `refactor: remove dead after-variable + no-op transform in controls rack`
