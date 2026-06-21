import { DEFAULT_PROFILE } from './profile.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// getLatestRaw() must return the most recent RawFrame.
export async function runCalibration({ getLatestRaw }) {
  const profile = structuredClone(DEFAULT_PROFILE);
  // Intensity is now hand HEIGHT, so we only calibrate each hand's high/low reach
  // (keep your hand at a comfortable arm's length — no need to approach the camera).
  const steps = [
    ['Raise your LEFT hand HIGH with an OPEN palm (whole hand in frame), then click OK', 'left', 'height', 'heightHigh'],
    ['Lower your LEFT hand LOW with an OPEN palm (whole hand in frame), then click OK', 'left', 'height', 'heightLow'],
    ['Raise your RIGHT hand HIGH with an OPEN palm (whole hand in frame), then click OK', 'right', 'height', 'heightHigh'],
    ['Lower your RIGHT hand LOW with an OPEN palm (whole hand in frame), then click OK', 'right', 'height', 'heightLow'],
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
