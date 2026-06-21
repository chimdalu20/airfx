export const FILTER = { min: 80, max: 12000, q: 1.0 };
export const REVERB = { wetMax: 1.3 };
export const DELAY = { time: 0.28, feedbackMin: 0.15, feedbackMax: 0.6, mixMin: 0.0, mixMax: 0.55 };
export const TREMOLO = { rateMin: 3, rateMax: 14, depthMax: 1.0 };
// Compressor: more hand height -> lower threshold + higher ratio (more squash).
export const COMPRESSOR = { thresholdMin: -6, thresholdMax: -40, ratioMin: 2, ratioMax: 12, knee: 28, attack: 0.003, release: 0.25 };
// Intensity reaches full at this fraction of the calibrated height range (so you do
// not have to raise your hand all the way to the top to get the maximum effect).
export const INTENSITY = { fullAt: 0.75 };
export const SMOOTH = { minCutoff: 1.2, beta: 0.6, dCutoff: 1.0 };
export const DEBOUNCE = { fingerFrames: 4 };
export const PRESENCE = { enter: 0.6, exit: 0.4 };
// Open-palm engage: engage when >= 3 fingers extended, disengage when <= 1 (hysteresis).
export const OPEN = { enter: 3, exit: 1 };
export const PARAM = { timeConstant: 0.03 };
export const KNOB = { sweepDeg: 270 };

export const PRESETS = {
  Subtle:  { reverbWetMax: 0.7, delayFeedbackMax: 0.4,  tremoloDepthMax: 0.7 },
  Lush:    { reverbWetMax: 1.3, delayFeedbackMax: 0.6,  tremoloDepthMax: 1.0 },
  Extreme: { reverbWetMax: 1.7, delayFeedbackMax: 0.85, tremoloDepthMax: 1.0 },
};
