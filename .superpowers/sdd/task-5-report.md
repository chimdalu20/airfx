# Task 5 Report: Calibration profile + normalization

## Summary
Successfully implemented per-user hand calibration profile and normalization module for AirFX. The module exports a `DEFAULT_PROFILE` with per-hand calibration data and an `applyCalibration` function that normalizes hand height and distance observations to 0..1 ranges using calibration parameters.

## Implementation Details

### Files Created
- **src/calibration/profile.js** — Exports `DEFAULT_PROFILE` (with left/right hand calibration data) and `applyCalibration({ height, size }, calibration)` function
- **tests/profile.test.js** — Comprehensive test suite covering distance/height normalization, clamping behavior, and profile structure

### Core Logic
- **heightNorm**: Maps hand height from `heightLow..heightHigh` to `0..1` using the existing `normalize` helper
- **distanceNorm**: Inverts hand size mapping so that larger sizes (closer hand) → 0, smaller sizes (farther hand) → 1, using `1 - normalize(size, sizeFar, sizeNear)`
- **Clamping**: Both normalized values automatically clamp to [0, 1] via the `normalize` helper's built-in clamping

### Test Coverage
All 4 test cases pass:
1. Distance normalization: near=0, far=1, midpoint≈0.5
2. Height normalization: low=0, high=1
3. Out-of-range clamping behavior
4. DEFAULT_PROFILE structure validation (both hands present)

## Verification
- **npm test result**: All 21 tests pass (4 new profile tests + 17 existing task 1-4 tests)
- **No regressions**: All prior tests remain green
- **Pristine output**: No warnings or errors in test run

## Commit
- **SHA**: ce3a582
- **Message**: feat: calibration profile + per-user normalization
- **Co-author trailer**: Included

## Design Notes
- `DEFAULT_PROFILE` uses spread syntax to create independent copies for left/right hands (avoids accidental mutation issues)
- The distance normalization inversion (`1 - normalize(...)`) correctly maps physical intuition: larger hand = closer = smaller distance value
- All calibration params follow the existing normalized 0..1 range convention in the codebase
- The function signature matches downstream consumer expectations (Task 6+)

## No Issues
- No blocking concerns
- Code follows project patterns
- Ready for next task
