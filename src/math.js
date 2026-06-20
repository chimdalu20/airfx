export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const normalize = (x, min, max) =>
  max === min ? 0 : clamp((x - min) / (max - min), 0, 1);
export const logMap = (t, min, max) => min * Math.pow(max / min, clamp(t, 0, 1));
export const linMap = (t, min, max) => lerp(min, max, clamp(t, 0, 1));
