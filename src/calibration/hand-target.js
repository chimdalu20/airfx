import { HAND_CONNECTIONS } from '../gestures/landmarks.js';

// A canonical open hand, palm to camera, in a 0.70 x 1.00 box (y grows downward, like
// MediaPipe's normalized landmarks). Indices match MediaPipe's 21-point hand topology, so
// the ghost drawn from these is the same shape the tracker draws for a real hand — "fit
// your hand into the outline" is literally the two overlapping.
export const CANONICAL_HAND = [
  [0.35, 1.00], // 0  wrist
  [0.24, 0.92], // 1  thumb CMC
  [0.15, 0.81], // 2  thumb MCP
  [0.09, 0.70], // 3  thumb IP
  [0.05, 0.59], // 4  thumb tip
  [0.26, 0.61], // 5  index MCP
  [0.24, 0.45], // 6
  [0.23, 0.34], // 7
  [0.22, 0.24], // 8  index tip
  [0.35, 0.58], // 9  middle MCP  <- the reference point used for height + hit-testing
  [0.35, 0.41], // 10
  [0.35, 0.29], // 11
  [0.35, 0.18], // 12 middle tip
  [0.44, 0.60], // 13 ring MCP
  [0.46, 0.44], // 14
  [0.47, 0.33], // 15
  [0.48, 0.23], // 16 ring tip
  [0.53, 0.65], // 17 pinky MCP
  [0.57, 0.53], // 18
  [0.59, 0.44], // 19
  [0.61, 0.36], // 20 pinky tip
];

export const CANONICAL_BOX = { w: 0.70, h: 1.00 };
// Where the anchor sits inside that box, as a fraction of it. The ghost must be offset by
// this — not centred — or the drawn outline sits away from the point actually hit-tested.
export const ANCHOR_IN_BOX = { x: 0.35 / 0.70, y: 0.58 / 1.00 };
// Index 9 (middle MCP) is what handHeight() measures, so the ghost is anchored on it.
export const ANCHOR = 9;

// Where each step wants the hand, in MIRRORED screen coordinates: x 0 = screen-left,
// y 0 = top of frame. The high/low rows are generous rather than extreme so that the
// span always clears MIN_SPAN, and reaching them is comfortable seated at a laptop.
export const TARGETS = {
  'left-up': { x: 0.26, y: 0.24 },
  'left-down': { x: 0.26, y: 0.78 },
  'right-up': { x: 0.74, y: 0.24 },
  'right-down': { x: 0.74, y: 0.78 },
};

// Hit radius in normalized-x units. Forgiving on purpose: this is a target to aim at, not
// a test to pass.
export const HIT_RADIUS = 0.13;

export const targetKey = (side, dir) => `${side}-${dir}`;

// The tracked hand's anchor point in mirrored screen coordinates.
// MediaPipe x is un-mirrored; the video is displayed scaleX(-1), so screen x = 1 - x.
export function handAnchor(lm) {
  if (!lm || !lm[ANCHOR]) return null;
  return { x: 1 - lm[ANCHOR].x, y: lm[ANCHOR].y };
}

// Is the hand inside the target?
//
// `aspect` is stageWidth / stageHeight. Normalized x and y units are different pixel
// lengths on a 16:9 stage, so an equal-radius test in normalized space would be an
// ellipse on screen. Scaling the y radius by the aspect makes the tolerance an actual
// circle, matching the ring the user sees.
export function handFitsTarget(anchor, target, aspect = 1, radius = HIT_RADIUS) {
  if (!anchor || !target) return false;
  const rx = radius;
  const ry = radius * (aspect || 1);
  const dx = (anchor.x - target.x) / rx;
  const dy = (anchor.y - target.y) / ry;
  return dx * dx + dy * dy <= 1;
}

// 0 at the edge of the tolerance, 1 dead centre — drives the "closeness" feedback.
export function fitCloseness(anchor, target, aspect = 1, radius = HIT_RADIUS) {
  if (!anchor || !target) return 0;
  const rx = radius;
  const ry = radius * (aspect || 1);
  const dx = (anchor.x - target.x) / rx;
  const dy = (anchor.y - target.y) / ry;
  return Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
}

// Builds the ghost-hand SVG: the canonical skeleton, drawn with the same topology the
// overlay uses for the live hand.
export function buildGhostHandSvg() {
  const W = CANONICAL_BOX.w * 100;
  const H = CANONICAL_BOX.h * 100;
  const pt = (i) => [CANONICAL_HAND[i][0] * 100, CANONICAL_HAND[i][1] * 100];
  const bones = HAND_CONNECTIONS.map(([a, b]) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
  }).join('');
  const joints = CANONICAL_HAND.map((_, i) => {
    const [x, y] = pt(i);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" />`;
  }).join('');
  return `<svg class="cal-ghost-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <g class="cal-ghost-bones">${bones}</g>
    <g class="cal-ghost-joints">${joints}</g>
  </svg>`;
}
