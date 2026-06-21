import { logMap, linMap } from '../math.js';
import { FILTER, REVERB, DELAY, TREMOLO } from '../config.js';

// Control model: each hand's effects are ENGAGED by an open palm (signals.*.engaged)
// and their INTENSITY is the hand HEIGHT (signals.*.heightNorm, 0..1). No distance:
// the user never needs to approach the camera, which is where tracking/handedness break.
//
// signals = {
//   left:  { present: bool, engaged: bool, heightNorm: 0..1 },  // filter + reverb + delay
//   right: { present: bool, engaged: bool, heightNorm: 0..1 },  // tremolo
// }
export function mapSignalsToSnapshot(signals) {
  const L = signals.left;
  const R = signals.right;

  // LEFT hand: open palm engages filter+reverb+delay; raising the hand intensifies them.
  const lOn = L.present && L.engaged;
  const lh = L.heightNorm;
  const cutoff = lOn ? logMap(lh, FILTER.min, FILTER.max) : FILTER.max; // disengaged = filter wide open (dry)
  const wet = lOn ? REVERB.wetMax * lh : 0;
  const mix = lOn ? linMap(lh, DELAY.mixMin, DELAY.mixMax) : 0;
  const feedback = lOn ? linMap(lh, DELAY.feedbackMin, DELAY.feedbackMax) : 0;

  // RIGHT hand: open palm engages tremolo; height intensifies rate + depth.
  const rOn = R.present && R.engaged;
  const rh = R.heightNorm;
  const rate = logMap(rh, TREMOLO.rateMin, TREMOLO.rateMax);
  const depth = rOn ? linMap(rh, 0, TREMOLO.depthMax) : 0;

  return {
    filter: { cutoff, q: FILTER.q },
    reverb: { wet, active: lOn },
    delay: { mix, time: DELAY.time, feedback, active: lOn },
    tremolo: { rate, depth, active: rOn },
  };
}
