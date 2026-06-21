import { logMap, linMap, clamp } from '../math.js';
import { FILTER, REVERB, DELAY, TREMOLO, COMPRESSOR, INTENSITY } from '../config.js';

// Control model:
//   - Each effect is turned ON/OFF by clicking its card -> `enabled` mask.
//   - INTENSITY of an enabled effect is the controlling hand's HEIGHT (left hand drives
//     filter+reverb+delay, right hand drives tremolo). Full intensity is reached at
//     INTENSITY.fullAt (e.g. 75%) of the calibrated height range, so you don't have to
//     raise your hand all the way to the top.
//
// signals = { left: { present, heightNorm }, right: { present, heightNorm } }
// enabled = { filter, reverb, delay, tremolo }  (booleans)
const e = (h) => clamp(h / INTENSITY.fullAt, 0, 1);

export function mapSignalsToSnapshot(signals, enabled = { filter: true, reverb: true, delay: true, tremolo: true, compressor: true }) {
  const lh = e(signals.left.heightNorm);
  const rh = e(signals.right.heightNorm);

  // LEFT hand effects (filter / reverb / delay), each gated by its own click toggle.
  const cutoff = enabled.filter ? logMap(lh, FILTER.min, FILTER.max) : FILTER.max; // off = filter wide open (dry)
  const wet = enabled.reverb ? REVERB.wetMax * lh : 0;
  const mix = enabled.delay ? linMap(lh, DELAY.mixMin, DELAY.mixMax) : 0;
  const feedback = enabled.delay ? linMap(lh, DELAY.feedbackMin, DELAY.feedbackMax) : 0;

  // RIGHT hand effect (tremolo): height intensifies rate + depth.
  const rate = logMap(rh, TREMOLO.rateMin, TREMOLO.rateMax);
  const depth = enabled.tremolo ? linMap(rh, 0, TREMOLO.depthMax) : 0;

  // Compressor (right hand): more height -> lower threshold + higher ratio.
  const compOn = !!enabled.compressor;
  const threshold = compOn ? linMap(rh, COMPRESSOR.thresholdMin, COMPRESSOR.thresholdMax) : 0;
  const ratio = compOn ? linMap(rh, COMPRESSOR.ratioMin, COMPRESSOR.ratioMax) : 1;

  return {
    filter: { cutoff, q: FILTER.q },
    reverb: { wet, active: !!enabled.reverb },
    delay: { mix, time: DELAY.time, feedback, active: !!enabled.delay },
    tremolo: { rate, depth, active: !!enabled.tremolo },
    compressor: { amount: compOn ? rh : 0, threshold, ratio, active: compOn },
  };
}

// Grab mode: build the snapshot from per-knob values (0..1) the user set by grabbing,
// instead of from hand height. Same param ranges as the gesture mapping above.
export function mapKnobsToSnapshot(kv, enabled = { filter: true, reverb: true, delay: true, tremolo: true, compressor: true }) {
  const g = (id) => clamp(kv[id] ?? 0, 0, 1);
  const cutoff = enabled.filter ? logMap(g('filter.cutoff'), FILTER.min, FILTER.max) : FILTER.max;
  const wet = enabled.reverb ? REVERB.wetMax * g('reverb.wet') : 0;
  const mix = enabled.delay ? linMap(g('delay.mix'), DELAY.mixMin, DELAY.mixMax) : 0;
  const feedback = enabled.delay ? linMap(g('delay.feedback'), DELAY.feedbackMin, DELAY.feedbackMax) : 0;
  const rate = logMap(g('tremolo.rate'), TREMOLO.rateMin, TREMOLO.rateMax);
  const depth = enabled.tremolo ? linMap(g('tremolo.depth'), 0, TREMOLO.depthMax) : 0;
  const compOn = !!enabled.compressor;
  const camt = g('compressor.amount');
  const threshold = compOn ? linMap(camt, COMPRESSOR.thresholdMin, COMPRESSOR.thresholdMax) : 0;
  const ratio = compOn ? linMap(camt, COMPRESSOR.ratioMin, COMPRESSOR.ratioMax) : 1;
  return {
    filter: { cutoff, q: FILTER.q },
    reverb: { wet, active: !!enabled.reverb },
    delay: { mix, time: DELAY.time, feedback, active: !!enabled.delay },
    tremolo: { rate, depth, active: !!enabled.tremolo },
    compressor: { amount: compOn ? camt : 0, threshold, ratio, active: compOn },
  };
}
