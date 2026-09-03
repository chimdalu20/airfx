import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapSignalsToSnapshot, mapKnobsToSnapshot } from '../src/mapping/mapping.js';
import { FILTER } from '../src/config.js';

const sig = (lh, rh) => ({ left: { present: true, heightNorm: lh }, right: { present: true, heightNorm: rh } });
const ALL = { filter: true, reverb: true, delay: true, tremolo: true, compressor: true };

test('filter cutoff (log) reaches max at 75% height (fullAt), min at 0', () => {
  // Compare against config, not a literal: the floor is sound design and may be retuned.
  assert.ok(Math.abs(mapSignalsToSnapshot(sig(0, 0), ALL).filter.cutoff - FILTER.min) < 1e-6);
  assert.ok(Math.abs(mapSignalsToSnapshot(sig(0.75, 0), ALL).filter.cutoff - FILTER.max) < 1e-6);
  assert.ok(Math.abs(mapSignalsToSnapshot(sig(1, 0), ALL).filter.cutoff - FILTER.max) < 1e-6);
});

test('the fully-swept filter is muffled but never silent', () => {
  // A cutoff down at 80 Hz removed essentially everything audible, so a hand entering
  // frame low made the track disappear. Whatever the floor is retuned to, keep it audible.
  assert.ok(FILTER.min >= 200, `filter floor ${FILTER.min} Hz must stay audible`);
});

test('an absent hand is DRY, not intensity zero', () => {
  // The bug: no hand -> heightNorm 0 -> filter fully CLOSED -> silence on first play.
  const none = {
    left: { present: false, heightNorm: 0 },
    right: { present: false, heightNorm: 0 },
  };
  const s = mapSignalsToSnapshot(none, ALL);
  assert.ok(Math.abs(s.filter.cutoff - FILTER.max) < 1e-6, 'filter wide open with no hand');
  assert.equal(s.reverb.wet, 0);
  assert.equal(s.delay.mix, 0);
  assert.equal(s.tremolo.depth, 0);
  assert.equal(s.compressor.amount, 0);
});

test('an absent hand stays dry even if its last height was high', () => {
  // heightNorm holds its last value when a hand leaves frame, so presence must win.
  const stale = {
    left: { present: false, heightNorm: 0.9 },
    right: { present: false, heightNorm: 0.9 },
  };
  const s = mapSignalsToSnapshot(stale, ALL);
  assert.ok(Math.abs(s.filter.cutoff - FILTER.max) < 1e-6);
  assert.equal(s.reverb.wet, 0);
  assert.equal(s.tremolo.depth, 0);
});

test('one hand present does not dry out the other hand', () => {
  const s = mapSignalsToSnapshot({
    left: { present: true, heightNorm: 0.75 },
    right: { present: false, heightNorm: 0.75 },
  }, ALL);
  assert.ok(s.reverb.wet > 0, 'left hand still drives reverb');
  assert.equal(s.tremolo.depth, 0, 'absent right hand is dry');
});

test('presence defaults to true when a caller omits it', () => {
  const s = mapSignalsToSnapshot({ left: { heightNorm: 0.75 }, right: { heightNorm: 0.75 } }, ALL);
  assert.ok(s.reverb.wet > 0);
  assert.ok(s.tremolo.depth > 0);
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

test('compressor: more right-hand height squashes harder; off bypasses', () => {
  const lo = mapSignalsToSnapshot(sig(0, 0.2), ALL).compressor;
  const hi = mapSignalsToSnapshot(sig(0, 0.75), ALL).compressor;
  assert.equal(hi.active, true);
  assert.ok(hi.ratio > lo.ratio); // more height -> higher ratio
  assert.ok(hi.threshold < lo.threshold); // more height -> lower threshold (more compression)
  const off = mapSignalsToSnapshot(sig(0, 1), { ...ALL, compressor: false }).compressor;
  assert.equal(off.active, false);
  assert.equal(off.ratio, 1);
  assert.equal(off.threshold, 0);
});

test('grab mode: mapKnobsToSnapshot maps per-knob values to params, gated by enabled', () => {
  const kv = {
    'filter.cutoff': 1, 'reverb.wet': 1, 'delay.mix': 1, 'delay.feedback': 1,
    'tremolo.rate': 1, 'tremolo.depth': 1, 'compressor.amount': 1,
  };
  const s = mapKnobsToSnapshot(kv, ALL);
  assert.ok(Math.abs(s.filter.cutoff - 12000) < 1e-6);
  assert.ok(s.reverb.wet > 0 && s.reverb.active === true);
  assert.ok(s.tremolo.depth > 0 && s.tremolo.active === true);
  assert.equal(s.compressor.active, true);
  const off = mapKnobsToSnapshot(kv, { filter: false, reverb: false, delay: false, tremolo: false, compressor: false });
  assert.equal(off.reverb.wet, 0);
  assert.equal(off.reverb.active, false);
  assert.ok(Math.abs(off.filter.cutoff - 12000) < 1e-6);
});

test('default enabled mask is all-on', () => {
  const s = mapSignalsToSnapshot(sig(0.5, 0.5));
  assert.equal(s.reverb.active, true);
  assert.equal(s.tremolo.active, true);
});
