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

export const handHeight = (lm) => 1 - lm[9].y;
export const handSize = (lm) => Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
