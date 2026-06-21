import { DEFAULT_PROFILE } from './profile.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// getLatestRaw() must return the most recent RawFrame.
export async function runCalibration({ getLatestRaw }) {
  const profile = structuredClone(DEFAULT_PROFILE);
  const steps = [
    ['Hold your LEFT hand FAIRLY CLOSE (~30cm, whole hand visible — do NOT touch the screen), then click OK', 'left', 'size', 'sizeNear'],
    ['Hold your LEFT hand FAR (arm extended), then click OK', 'left', 'size', 'sizeFar'],
    ['Raise your LEFT hand HIGH (still in frame), then click OK', 'left', 'height', 'heightHigh'],
    ['Lower your LEFT hand LOW (still in frame), then click OK', 'left', 'height', 'heightLow'],
    ['Hold your RIGHT hand FAIRLY CLOSE (~30cm, whole hand visible — do NOT touch the screen), then click OK', 'right', 'size', 'sizeNear'],
    ['Hold your RIGHT hand FAR (arm extended), then click OK', 'right', 'size', 'sizeFar'],
    ['Raise your RIGHT hand HIGH (still in frame), then click OK', 'right', 'height', 'heightHigh'],
    ['Lower your RIGHT hand LOW (still in frame), then click OK', 'right', 'height', 'heightLow'],
  ];
  for (const [prompt, side, field, target] of steps) {
    // eslint-disable-next-line no-alert
    window.alert(prompt);
    const raw = getLatestRaw();
    const obs = raw?.[side];
    if (obs) profile[side][target] = obs[field];
  }
  saveProfile(profile);
  return profile;
}
