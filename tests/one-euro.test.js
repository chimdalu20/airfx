import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OneEuroFilter } from '../src/smoothing/one-euro.js';

test('first sample returns the input', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  assert.equal(f.filter(0.42, 0), 0.42);
});

test('constant input converges to the constant', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  let out;
  for (let i = 0; i < 50; i++) out = f.filter(5, i * 33);
  assert.ok(Math.abs(out - 5) < 1e-3);
});

test('a step does not jump fully in one frame (lag present)', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  for (let i = 0; i < 10; i++) f.filter(0, i * 33);
  const out = f.filter(10, 10 * 33);
  assert.ok(out > 0 && out < 10);
});

test('reduces jitter vs raw alternating signal', () => {
  const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
  const outs = [];
  for (let i = 0; i < 40; i++) outs.push(f.filter(i % 2 === 0 ? 0.4 : 0.6, i * 33));
  const tail = outs.slice(20);
  const range = Math.max(...tail) - Math.min(...tail);
  assert.ok(range < 0.2); // raw range is 0.2; smoothed must be smaller
});
