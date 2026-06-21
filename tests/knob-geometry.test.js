import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueToAngle, snapshotToDisplay } from '../src/ui/knob-geometry.js';

test('valueToAngle centers and spans the sweep', () => {
  assert.equal(valueToAngle(0, 270), -135);
  assert.equal(valueToAngle(0.5, 270), 0);
  assert.equal(valueToAngle(1, 270), 135);
});

test('valueToAngle clamps out-of-range input', () => {
  assert.equal(valueToAngle(-1, 270), -135);
  assert.equal(valueToAngle(2, 270), 135);
});

test('snapshotToDisplay normalizes cutoff back to 0..1 (log inverse)', () => {
  const lo = snapshotToDisplay({ filter: { cutoff: 80, q: 1 }, reverb: { wet: 0, active: false }, delay: { mix: 0, time: 0.28, feedback: 0, active: false }, tremolo: { rate: 0.1, depth: 0, active: false } });
  const hi = snapshotToDisplay({ filter: { cutoff: 12000, q: 1 }, reverb: { wet: 1.3, active: true }, delay: { mix: 0.5, time: 0.28, feedback: 0.55, active: true }, tremolo: { rate: 12, depth: 1, active: true } });
  assert.ok(Math.abs(lo.filter.cutoff - 0) < 1e-6);
  assert.ok(Math.abs(hi.filter.cutoff - 1) < 1e-6);
  assert.ok(Math.abs(hi.reverb.wet - 1) < 1e-6);
  assert.ok(Math.abs(hi.tremolo.depth - 1) < 1e-6);
});
