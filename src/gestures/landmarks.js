// MediaPipe's 21-point hand topology. Shared by the live overlay and the calibration
// ghost so both draw the same skeleton.
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// Non-thumb fingers as [tipIndex, pipIndex].
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]];

export function fingerExtended(lm, tip, pip) {
  return lm[tip].y < lm[pip].y; // smaller y = higher on screen = extended (image origin top-left)
}

export function countExtendedFingers(lm, handedness) {
  let count = 0;
  for (const [tip, pip] of FINGERS) if (fingerExtended(lm, tip, pip)) count++;
  // Thumb: compare tip(4) x vs IP(3) x. Mirror-selfie: Right hand thumb extends to the left.
  const thumbExtended = handedness === 'Right' ? lm[4].x < lm[3].x : lm[4].x > lm[3].x;
  if (thumbExtended) count++;
  return count;
}

// Count of extended NON-thumb fingers (0..4). Handedness-free, so it is robust for
// the open-palm (>=3) vs fist (<=1) engage gesture regardless of which hand it is.
export function countOpenFingers(lm) {
  let n = 0;
  for (const [tip, pip] of FINGERS) if (fingerExtended(lm, tip, pip)) n++;
  return n;
}

export const handHeight = (lm) => 1 - lm[9].y;
export const handSize = (lm) => Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
