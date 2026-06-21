import { clamp } from '../math.js';
import { FILTER, REVERB, DELAY, TREMOLO } from '../config.js';

export function valueToAngle(value, sweepDeg = 270) {
  const v = clamp(value, 0, 1);
  return -sweepDeg / 2 + v * sweepDeg;
}

const logNorm = (v, min, max) =>
  v <= min ? 0 : v >= max ? 1 : Math.log(v / min) / Math.log(max / min);
const linNorm = (v, min, max) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1));

export function snapshotToDisplay(s) {
  return {
    filter: { cutoff: logNorm(s.filter.cutoff, FILTER.min, FILTER.max) },
    reverb: { wet: linNorm(s.reverb.wet, 0, REVERB.wetMax), active: s.reverb.active },
    delay: {
      mix: linNorm(s.delay.mix, DELAY.mixMin, DELAY.mixMax),
      feedback: linNorm(s.delay.feedback, DELAY.feedbackMin, DELAY.feedbackMax),
      active: s.delay.active,
    },
    tremolo: {
      rate: logNorm(s.tremolo.rate, TREMOLO.rateMin, TREMOLO.rateMax),
      depth: linNorm(s.tremolo.depth, 0, TREMOLO.depthMax),
      active: s.tremolo.active,
    },
    compressor: { amount: clamp(s.compressor.amount, 0, 1), active: s.compressor.active },
  };
}
