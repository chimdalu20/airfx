import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSignalsToSnapshot } from '../src/mapping/mapping.js';

const base = {
  left: { present: true, fingers: 1, heightNorm: 0.5, distanceNorm: 0.5 },
  right: { present: false, heightNorm: 0.5, distanceNorm: 0.5 },
};

test('left height drives filter cutoff (log) across the range', () => {
  const lo = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 0 } });
  const hi = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1 } });
  assert.ok(Math.abs(lo.filter.cutoff - 80) < 1e-6);
  assert.ok(Math.abs(hi.filter.cutoff - 12000) < 1e-6);
});

test('1 finger = reverb active, delay inactive', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { ...base.left, fingers: 1 } });
  assert.equal(s.reverb.active, true);
  assert.equal(s.delay.active, false);
});

test('2 fingers = reverb + delay active', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { ...base.left, fingers: 2 } });
  assert.equal(s.reverb.active, true);
  assert.equal(s.delay.active, true);
});

test('left distance scales reverb wet (master intensity)', () => {
  const near = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1, distanceNorm: 0 } });
  const far = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1, distanceNorm: 1 } });
  assert.ok(far.reverb.wet > near.reverb.wet);
});

test('left absent opens the filter and bypasses reverb/delay', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { present: false, fingers: 0, heightNorm: 0, distanceNorm: 0 } });
  assert.ok(Math.abs(s.filter.cutoff - 12000) < 1e-6);
  assert.equal(s.reverb.active, false);
  assert.equal(s.delay.active, false);
});

test('right present = tremolo; height=rate, distance=depth', () => {
  const s = mapSignalsToSnapshot({ ...base, right: { present: true, heightNorm: 1, distanceNorm: 1 } });
  assert.equal(s.tremolo.active, true);
  assert.ok(Math.abs(s.tremolo.rate - 12) < 1e-6);
  assert.ok(Math.abs(s.tremolo.depth - 1) < 1e-6);
});

test('right absent = tremolo inactive, depth 0', () => {
  const s = mapSignalsToSnapshot(base);
  assert.equal(s.tremolo.active, false);
  assert.equal(s.tremolo.depth, 0);
});
