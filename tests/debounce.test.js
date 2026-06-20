import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Debounced, Hysteresis } from '../src/smoothing/debounce.js';

test('Debounced commits only after N identical pushes', () => {
  const d = new Debounced(3, 0);
  assert.equal(d.push(1), 0);
  assert.equal(d.push(1), 0);
  assert.equal(d.push(1), 1); // 3rd identical -> commit
});

test('Debounced flicker resets the streak', () => {
  const d = new Debounced(3, 0);
  d.push(1); d.push(1);
  assert.equal(d.push(2), 0); // changed candidate, streak resets, not committed
  d.push(2);
  assert.equal(d.push(2), 2);
});

test('Hysteresis uses separate enter/exit thresholds', () => {
  const h = new Hysteresis(0.6, 0.4, false);
  assert.equal(h.update(0.5), false); // below enter
  assert.equal(h.update(0.65), true); // crosses enter
  assert.equal(h.update(0.5), true);  // between exit and enter -> holds
  assert.equal(h.update(0.3), false); // below exit
});

test('Hysteresis rejects exit > enter', () => {
  assert.throws(() => new Hysteresis(0.4, 0.6));
});
