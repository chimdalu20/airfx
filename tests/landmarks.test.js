import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countExtendedFingers, countOpenFingers, handHeight, handSize, fingerExtended } from '../src/gestures/landmarks.js';

// Helper: 21 neutral points, all folded (tip.y == pip.y), thumb folded.
function blankHand() {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

test('countOpenFingers: 0 for a fist, 4 for an open palm (non-thumb)', () => {
  const fist = blankHand(); // all tips == pips -> none extended
  assert.equal(countOpenFingers(fist), 0);
  const palm = blankHand();
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    palm[tip] = { x: 0.5, y: 0.2, z: 0 };
    palm[pip] = { x: 0.5, y: 0.4, z: 0 };
  }
  assert.equal(countOpenFingers(palm), 4);
});

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

test('counts an extended thumb on a Right hand', () => {
  const lm = blankHand();
  lm[4] = { x: 0.3, y: 0.5, z: 0 }; // tip left of IP -> extended (mirrored Right)
  lm[3] = { x: 0.5, y: 0.5, z: 0 };
  assert.equal(countExtendedFingers(lm, 'Right'), 1);
});

test('counts an extended thumb on a Left hand (opposite x direction)', () => {
  const lm = blankHand();
  lm[4] = { x: 0.7, y: 0.5, z: 0 }; // tip right of IP -> extended (mirrored Left)
  lm[3] = { x: 0.5, y: 0.5, z: 0 };
  assert.equal(countExtendedFingers(lm, 'Left'), 1);
});

test('open palm (4 fingers + thumb) counts 5 on a Right hand', () => {
  const lm = blankHand();
  for (const [tip, pip] of [[8,6],[12,10],[16,14],[20,18]]) {
    lm[tip] = { x: 0.5, y: 0.2, z: 0 };
    lm[pip] = { x: 0.5, y: 0.4, z: 0 };
  }
  lm[4] = { x: 0.3, y: 0.5, z: 0 };
  lm[3] = { x: 0.5, y: 0.5, z: 0 };
  assert.equal(countExtendedFingers(lm, 'Right'), 5);
});

test('fingerExtended is true when tip is above pip, false when equal', () => {
  const lm = blankHand();
  lm[8] = { x: 0.5, y: 0.2, z: 0 };
  lm[6] = { x: 0.5, y: 0.4, z: 0 };
  assert.equal(fingerExtended(lm, 8, 6), true);
  assert.equal(fingerExtended(lm, 12, 10), false); // both 0.5 -> not extended
});
