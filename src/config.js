export const FILTER = { min: 80, max: 12000, q: 1.0 };
export const REVERB = { wetMax: 0.9, heightFloor: 0.3 };
export const DELAY = { time: 0.28, feedbackMin: 0.15, feedbackMax: 0.55, mixMin: 0.0, mixMax: 0.5 };
export const TREMOLO = { rateMin: 0.1, rateMax: 12, depthMax: 1.0 };
export const SMOOTH = { minCutoff: 1.2, beta: 0.6, dCutoff: 1.0 };
export const DEBOUNCE = { fingerFrames: 4 };
export const PRESENCE = { enter: 0.6, exit: 0.4 };
// Open-palm engage: engage when >= 3 fingers extended, disengage when <= 1 (hysteresis).
export const OPEN = { enter: 3, exit: 1 };
export const PARAM = { timeConstant: 0.03 };
export const KNOB = { sweepDeg: 270 };

export const PRESETS = {
  Subtle:  { reverbWetMax: 0.5, delayFeedbackMax: 0.35, tremoloDepthMax: 0.6 },
  Lush:    { reverbWetMax: 0.9, delayFeedbackMax: 0.55, tremoloDepthMax: 1.0 },
  Extreme: { reverbWetMax: 1.0, delayFeedbackMax: 0.85, tremoloDepthMax: 1.0 },
};
