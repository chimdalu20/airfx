import { normalize } from '../math.js';

const DEFAULT_HAND = { sizeNear: 0.45, sizeFar: 0.15, heightLow: 0.1, heightHigh: 0.9 };

export const DEFAULT_PROFILE = {
  left: { ...DEFAULT_HAND },
  right: { ...DEFAULT_HAND },
};

export function applyCalibration({ height, size }, cal) {
  const heightNorm = normalize(height, cal.heightLow, cal.heightHigh);
  const distanceNorm = 1 - normalize(size, cal.sizeFar, cal.sizeNear);
  return { heightNorm, distanceNorm };
}
