import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, applyCalibration } from '../src/calibration/profile.js';

const cal = { sizeNear: 0.45, sizeFar: 0.15, heightLow: 0.1, heightHigh: 0.9 };

test('distanceNorm: near=0, far=1, mid=0.5', () => {
  assert.equal(applyCalibration({ height: 0.5, size: 0.45 }, cal).distanceNorm, 0);
  assert.equal(applyCalibration({ height: 0.5, size: 0.15 }, cal).distanceNorm, 1);
  assert.ok(Math.abs(applyCalibration({ height: 0.5, size: 0.30 }, cal).distanceNorm - 0.5) < 1e-9);
});

test('heightNorm: low=0, high=1', () => {
  assert.equal(applyCalibration({ height: 0.1, size: 0.3 }, cal).heightNorm, 0);
  assert.equal(applyCalibration({ height: 0.9, size: 0.3 }, cal).heightNorm, 1);
});

test('values clamp outside the calibrated range', () => {
  assert.equal(applyCalibration({ height: 1.0, size: 0.6 }, cal).distanceNorm, 0); // bigger than near
  assert.equal(applyCalibration({ height: 0.0, size: 0.3 }, cal).heightNorm, 0);
});

test('DEFAULT_PROFILE has both hands', () => {
  assert.ok(DEFAULT_PROFILE.left && DEFAULT_PROFILE.right);
});
