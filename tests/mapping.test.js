import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSignalsToSnapshot } from '../src/mapping/mapping.js';

const base = {
  left: { present: true, engaged: true, heightNorm: 0.5 },
  right: { present: false, engaged: false, heightNorm: 0.5 },
};

test('engaged left height drives filter cutoff (log) across the range', () => {
  const lo = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 0 } });
  const hi = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 1 } });
  assert.ok(Math.abs(lo.filter.cutoff - 80) < 1e-6);
  assert.ok(Math.abs(hi.filter.cutoff - 12000) < 1e-6);
});

test('open left palm engages reverb + delay', () => {
  const s = mapSignalsToSnapshot(base);
  assert.equal(s.reverb.active, true);
  assert.equal(s.delay.active, true);
});

test('closed left (not engaged) bypasses reverb/delay and opens the filter', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { present: true, engaged: false, heightNorm: 0.5 } });
  assert.equal(s.reverb.active, false);
  assert.equal(s.delay.active, false);
  assert.equal(s.reverb.wet, 0);
  assert.ok(Math.abs(s.filter.cutoff - 12000) < 1e-6);
});

test('absent left hand bypasses reverb/delay and opens the filter', () => {
  const s = mapSignalsToSnapshot({ ...base, left: { present: false, engaged: true, heightNorm: 1 } });
  assert.equal(s.reverb.active, false);
  assert.equal(s.delay.active, false);
  assert.ok(Math.abs(s.filter.cutoff - 12000) < 1e-6);
});

test('engaged left height scales reverb wet (intensity)', () => {
  const low = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 0.2 } });
  const high = mapSignalsToSnapshot({ ...base, left: { ...base.left, heightNorm: 0.9 } });
  assert.ok(high.reverb.wet > low.reverb.wet);
});

test('open right palm engages tremolo; height scales rate + depth', () => {
  const s = mapSignalsToSnapshot({ ...base, right: { present: true, engaged: true, heightNorm: 1 } });
  assert.equal(s.tremolo.active, true);
  assert.ok(Math.abs(s.tremolo.rate - 12) < 1e-6);
  assert.ok(Math.abs(s.tremolo.depth - 1) < 1e-6);
});

test('closed/absent right hand = tremolo inactive, depth 0', () => {
  assert.equal(mapSignalsToSnapshot(base).tremolo.active, false);
  assert.equal(mapSignalsToSnapshot(base).tremolo.depth, 0);
  const closed = mapSignalsToSnapshot({ ...base, right: { present: true, engaged: false, heightNorm: 1 } });
  assert.equal(closed.tremolo.active, false);
  assert.equal(closed.tremolo.depth, 0);
});
