import { logMap, linMap, clamp } from '../math.js';
import { FILTER, REVERB, DELAY, TREMOLO } from '../config.js';

export function mapSignalsToSnapshot(signals) {
  const L = signals.left;
  const R = signals.right;

  // Filter: left height -> cutoff (log). Absent left hand -> fully open (bypass).
  const cutoff = L.present ? logMap(L.heightNorm, FILTER.min, FILTER.max) : FILTER.max;

  // Reverb: character from height, master intensity from distance.
  const reverbActive = L.present && L.fingers >= 1;
  const heightChar = linMap(L.heightNorm, REVERB.heightFloor, 1.0);
  const wet = reverbActive ? clamp(REVERB.wetMax * L.distanceNorm * heightChar, 0, REVERB.wetMax) : 0;

  // Delay: engaged at 2 fingers; distance -> mix + feedback.
  const delayActive = L.present && L.fingers >= 2;
  const mix = delayActive ? linMap(L.distanceNorm, DELAY.mixMin, DELAY.mixMax) : 0;
  const feedback = delayActive ? linMap(L.distanceNorm, DELAY.feedbackMin, DELAY.feedbackMax) : 0;

  // Tremolo: right presence engages; height -> rate (log), distance -> depth.
  const tremoloActive = R.present;
  const rate = logMap(R.heightNorm, TREMOLO.rateMin, TREMOLO.rateMax);
  const depth = tremoloActive ? linMap(R.distanceNorm, 0, TREMOLO.depthMax) : 0;

  return {
    filter: { cutoff, q: FILTER.q },
    reverb: { wet, active: reverbActive },
    delay: { mix, time: DELAY.time, feedback, active: delayActive },
    tremolo: { rate, depth, active: tremoloActive },
  };
}
