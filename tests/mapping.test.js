import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSignalsToSnapshot } from '../src/mapping/mapping.js';

const sig = (lh, rh) => ({ left: { present: true, heightNorm: lh }, right: { present: true, heightNorm: rh } });
const ALL = { filter: true, reverb: true, delay: true, tremolo: true };

test('filter cutoff (log) reaches max at 75% height (fullAt), min at 0', () => {
  assert.ok(Math.abs(mapSignalsToSnapshot(sig(0, 0), ALL).filter.cutoff - 80) < 1e-6);
  assert.ok(Math.abs(mapSignalsToSnapshot(sig(0.75, 0), ALL).filter.cutoff - 12000) < 1e-6);
  assert.ok(Math.abs(mapSignalsToSnapshot(sig(1, 0), ALL).filter.cutoff - 12000) < 1e-6);
});

test('enabled mask turns effects on/off (click toggle)', () => {
  const on = mapSignalsToSnapshot(sig(0.5, 0.5), ALL);
  assert.equal(on.reverb.active, true);
  assert.equal(on.delay.active, true);
  assert.equal(on.tremolo.active, true);
  const off = mapSignalsToSnapshot(sig(0.5, 0.5), { filter: false, reverb: false, delay: false, tremolo: false });
  assert.equal(off.reverb.active, false);
  assert.equal(off.reverb.wet, 0);
  assert.equal(off.delay.active, false);
  assert.equal(off.tremolo.active, false);
  assert.equal(off.tremolo.depth, 0);
  assert.ok(Math.abs(off.filter.cutoff - 12000) < 1e-6); // filter off = wide open (dry)
});

test('height scales intensity and saturates at fullAt (75%)', () => {
  const lowWet = mapSignalsToSnapshot(sig(0.4, 0), ALL).reverb.wet;
  const fullWet = mapSignalsToSnapshot(sig(0.75, 0), ALL).reverb.wet;
  const topWet = mapSignalsToSnapshot(sig(1.0, 0), ALL).reverb.wet;
  assert.ok(lowWet < fullWet);
  assert.ok(Math.abs(fullWet - topWet) < 1e-9); // saturates at fullAt
});

test('tremolo depth scales with right-hand height, 0 when disabled', () => {
  const lo = mapSignalsToSnapshot(sig(0, 0.3), ALL).tremolo.depth;
  const hi = mapSignalsToSnapshot(sig(0, 0.75), ALL).tremolo.depth;
  assert.ok(hi > lo);
  assert.equal(mapSignalsToSnapshot(sig(0, 1), { ...ALL, tremolo: false }).tremolo.depth, 0);
});

test('default enabled mask is all-on', () => {
  const s = mapSignalsToSnapshot(sig(0.5, 0.5));
  assert.equal(s.reverb.active, true);
  assert.equal(s.tremolo.active, true);
});
