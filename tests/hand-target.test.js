import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TARGETS, targetKey, handAnchor, handFitsTarget, fitCloseness,
  CANONICAL_HAND, ANCHOR, buildGhostHandSvg, HIT_RADIUS,
} from '../src/calibration/hand-target.js';

const lmAt = (x, y) => {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[ANCHOR] = { x, y };
  return lm;
};

test('handAnchor mirrors x, because the video is displayed scaleX(-1)', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const a1 = handAnchor(lmAt(0.8, 0.3));
  assert.ok(near(a1.x, 0.2) && near(a1.y, 0.3), `got ${JSON.stringify(a1)}`);
  const a2 = handAnchor(lmAt(0.25, 0.9));
  assert.ok(near(a2.x, 0.75) && near(a2.y, 0.9), `got ${JSON.stringify(a2)}`);
});

test('handAnchor is null for a missing hand', () => {
  assert.equal(handAnchor(null), null);
  assert.equal(handAnchor([]), null);
});

test('every step has a target, on the matching half of the frame', () => {
  for (const side of ['left', 'right']) {
    for (const dir of ['up', 'down']) {
      const t = TARGETS[targetKey(side, dir)];
      assert.ok(t, `${side}-${dir} has a target`);
      if (side === 'left') assert.ok(t.x < 0.5, 'left target is on screen-left');
      else assert.ok(t.x > 0.5, 'right target is on screen-right');
      if (dir === 'up') assert.ok(t.y < 0.5, 'up target is in the upper half');
      else assert.ok(t.y > 0.5, 'down target is in the lower half');
    }
  }
});

test('up and down targets span enough height to clear the degenerate-range guard', () => {
  for (const side of ['left', 'right']) {
    const up = TARGETS[targetKey(side, 'up')];
    const down = TARGETS[targetKey(side, 'down')];
    // height = 1 - y, so the span in height terms is the span in y terms.
    assert.ok(Math.abs(down.y - up.y) > 0.10, `${side} span exceeds MIN_SPAN`);
  }
});

test('a hand on the target is inside; one far away is not', () => {
  const t = TARGETS['left-up'];
  assert.equal(handFitsTarget({ x: t.x, y: t.y }, t, 16 / 9), true);
  assert.equal(handFitsTarget({ x: t.x + 0.4, y: t.y }, t, 16 / 9), false);
  assert.equal(handFitsTarget({ x: t.x, y: t.y + 0.5 }, t, 16 / 9), false);
});

test('the tolerance is a circle on screen, not in normalized space', () => {
  const t = { x: 0.5, y: 0.5 };
  const aspect = 16 / 9;
  // Just inside horizontally.
  assert.equal(handFitsTarget({ x: 0.5 + HIT_RADIUS * 0.95, y: 0.5 }, t, aspect), true);
  // The same normalized offset vertically is a SMALLER pixel distance, so it must also
  // be inside — the y tolerance is stretched by the aspect ratio.
  assert.equal(handFitsTarget({ x: 0.5, y: 0.5 + HIT_RADIUS * 0.95 }, t, aspect), true);
  // Beyond the stretched y tolerance it is outside.
  assert.equal(handFitsTarget({ x: 0.5, y: 0.5 + HIT_RADIUS * aspect * 1.2 }, t, aspect), false);
});

test('missing anchor or target never counts as a fit', () => {
  assert.equal(handFitsTarget(null, TARGETS['left-up'], 1), false);
  assert.equal(handFitsTarget({ x: 0.2, y: 0.2 }, null, 1), false);
});

test('fitCloseness is 1 dead centre and 0 outside the tolerance', () => {
  const t = { x: 0.5, y: 0.5 };
  assert.equal(fitCloseness({ x: 0.5, y: 0.5 }, t, 1), 1);
  assert.equal(fitCloseness({ x: 0.5 + HIT_RADIUS, y: 0.5 }, t, 1), 0);
  assert.equal(fitCloseness({ x: 0.9, y: 0.9 }, t, 1), 0);
  const mid = fitCloseness({ x: 0.5 + HIT_RADIUS / 2, y: 0.5 }, t, 1);
  assert.ok(mid > 0.4 && mid < 0.6, `half way in is ~0.5, got ${mid}`);
});

test('the canonical hand has all 21 MediaPipe landmarks in the unit box', () => {
  assert.equal(CANONICAL_HAND.length, 21);
  for (const [x, y] of CANONICAL_HAND) {
    assert.ok(x >= 0 && x <= 1, `x ${x} in range`);
    assert.ok(y >= 0 && y <= 1, `y ${y} in range`);
  }
});

test('the ghost svg draws all 21 joints and the full skeleton', () => {
  const svg = buildGhostHandSvg();
  assert.equal((svg.match(/<circle/g) || []).length, 21);
  assert.equal((svg.match(/<line/g) || []).length, 21); // 21 bones in the topology
  assert.match(svg, /viewBox="0 0 70 100"/);
});
