import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countExtendedFingers, handHeight, handSize } from '../src/gestures/landmarks.js';

// Helper: 21 neutral points, all folded (tip.y == pip.y), thumb folded.
function blankHand() {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

test('counts one extended finger (index only)', () => {
  const lm = blankHand();
  lm[8] = { x: 0.5, y: 0.2, z: 0 };  // index tip high
  lm[6] = { x: 0.5, y: 0.4, z: 0 };  // index pip lower
  assert.equal(countExtendedFingers(lm, 'Right'), 1);
});

test('counts two extended fingers (index + middle)', () => {
  const lm = blankHand();
  lm[8] = { x: 0.5, y: 0.2, z: 0 }; lm[6] = { x: 0.5, y: 0.4, z: 0 };
  lm[12] = { x: 0.5, y: 0.2, z: 0 }; lm[10] = { x: 0.5, y: 0.4, z: 0 };
  assert.equal(countExtendedFingers(lm, 'Right'), 2);
});

test('handHeight inverts y (top of frame = 1)', () => {
  const lm = blankHand();
  lm[9] = { x: 0.5, y: 0.3, z: 0 };
  assert.ok(Math.abs(handHeight(lm) - 0.7) < 1e-9);
});

test('handSize is wrist-to-middle-MCP distance', () => {
  const lm = blankHand();
  lm[0] = { x: 0.5, y: 0.8, z: 0 };
  lm[9] = { x: 0.5, y: 0.5, z: 0 };
  assert.ok(Math.abs(handSize(lm) - 0.3) < 1e-9);
});
