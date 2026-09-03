# Task 7 Report: Knob Geometry

## Summary
Implemented pure view math functions for converting effect-parameter snapshots into knob rotation angles for the animated controls rack.

## Files Created
- `src/ui/knob-geometry.js` — Exports `valueToAngle` and `snapshotToDisplay`
- `tests/knob-geometry.test.js` — 3 test cases covering both functions

## Implementation Details

### `valueToAngle(value, sweepDeg = 270)`
Maps a 0..1 normalized value to a centered angle span. With default 270° sweep:
- 0 → -135°
- 0.5 → 0°
- 1 → 135°

Clamps out-of-range input to [0, 1] before calculation.

### `snapshotToDisplay(snapshot)`
Inverts the mapping curves from Task 6 to produce 0..1 display values:
- **Logarithmic inverse** (log norm): `filter.cutoff` (80–12000 Hz), `tremolo.rate` (0.1–12 Hz)
- **Linear inverse** (lin norm): `reverb.wet` (0–0.9), `delay.mix` (0–0.5), `delay.feedback` (0.15–0.55), `tremolo.depth` (0–1)

Returns a structured object matching the input snapshot structure, preserving boolean `active` flags and preserving/normalizing numeric parameters.

## Test Results
- ✓ valueToAngle centers and spans the sweep
- ✓ valueToAngle clamps out-of-range input
- ✓ snapshotToDisplay normalizes cutoff back to 0..1 (log inverse)

Full test suite: **35/35 pass** (32 existing + 3 new)

## Verification
- [x] Tests follow TDD pattern (fail → implement → pass)
- [x] Imports match brief exactly (`clamp` from math.js, config constants from config.js)
- [x] Function signatures match brief (default params, return structures)
- [x] No regressions (full suite runs clean)
- [x] Commit uses targeted `git add` (no `.superpowers/` included)
- [x] Commit message includes required trailer

## Commit
SHA: `3e5a6f5`  
Message: `feat: knob geometry + snapshot-to-display normalization`

## Next Steps
This module is ready for consumption by the controls rack UI (Task 8+). The `snapshotToDisplay` function directly undoes the mapping curves from Task 6, making it suitable for displaying current parameter values on the knob UI.
