import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyntheticGestureSource } from '../src/gestures/synthetic-source.js';

test('sample() returns whatever the fn produces', () => {
  const frame = { tMs: 0, left: { fingers: 2, height: 0.5, size: 0.3, confidence: 1 }, right: null };
  const src = new SyntheticGestureSource(() => frame);
  assert.deepEqual(src.sample(100), frame);
});

test('fn receives the timestamp', () => {
  const src = new SyntheticGestureSource((t) => ({ tMs: t, left: null, right: null }));
  assert.equal(src.sample(123).tMs, 123);
});
