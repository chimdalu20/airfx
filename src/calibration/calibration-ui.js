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
    ['Hold your LEFT hand CLOSE, then click OK', 'left', 'size', 'sizeNear'],
    ['Hold your LEFT hand FAR, then click OK', 'left', 'size', 'sizeFar'],
    ['Raise your LEFT hand HIGH, then click OK', 'left', 'height', 'heightHigh'],
    ['Lower your LEFT hand LOW, then click OK', 'left', 'height', 'heightLow'],
    ['Hold your RIGHT hand CLOSE, then click OK', 'right', 'size', 'sizeNear'],
    ['Hold your RIGHT hand FAR, then click OK', 'right', 'size', 'sizeFar'],
    ['Raise your RIGHT hand HIGH, then click OK', 'right', 'height', 'heightHigh'],
    ['Lower your RIGHT hand LOW, then click OK', 'right', 'height', 'heightLow'],
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
