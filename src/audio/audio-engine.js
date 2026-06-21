import { PARAM } from '../config.js';
import { generateImpulseResponse } from './reverb-ir.js';

// `sourceNode` is any AudioNode to process (e.g. a MediaElementAudioSourceNode
// from an uploaded <audio> track, or a MediaStreamAudioSourceNode from a mic).
export function createAudioEngine(ctx, sourceNode) {
  const source = sourceNode;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 12000;
  filter.Q.value = 1.0;

  // Tremolo: LFO -> depthGain -> tremGain.gain; base gain centers the swing.
  const tremGain = ctx.createGain();
  tremGain.gain.value = 1.0;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth).connect(tremGain.gain);
  lfo.start();

  // Delay with feedback.
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = 0.28;
  const feedback = ctx.createGain();
  feedback.gain.value = 0;
  const delayWet = ctx.createGain();
  delayWet.gain.value = 0;

  // Reverb (fixed IR; wet gain is the live control).
  const convolver = ctx.createConvolver();
  convolver.buffer = generateImpulseResponse(ctx, { seconds: 3.8, decay: 1.8 });
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;

  const dry = ctx.createGain();
  dry.gain.value = 1.0;

  const master = ctx.createGain();
  master.gain.value = 1.0;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  const dest = ctx.createMediaStreamDestination();

  // Routing: source -> filter -> tremGain -> {dry, delay, reverb} -> master -> limiter -> out + recorder
  source.connect(filter);
  filter.connect(tremGain);
  tremGain.connect(dry).connect(master);
  tremGain.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(delayWet).connect(master);
  tremGain.connect(convolver).connect(reverbWet).connect(master);
  master.connect(limiter);
  limiter.connect(ctx.destination);
  limiter.connect(dest);

  const tc = PARAM.timeConstant;

  function apply(snap) {
    const t = ctx.currentTime;
    filter.frequency.setTargetAtTime(snap.filter.cutoff, t, tc);
    filter.Q.setTargetAtTime(snap.filter.q, t, tc);
    reverbWet.gain.setTargetAtTime(snap.reverb.active ? snap.reverb.wet : 0, t, tc);
    delay.delayTime.setTargetAtTime(snap.delay.time, t, tc);
    delayWet.gain.setTargetAtTime(snap.delay.active ? snap.delay.mix : 0, t, tc);
    feedback.gain.setTargetAtTime(snap.delay.active ? Math.min(snap.delay.feedback, 0.89) : 0, t, tc);
    lfo.frequency.setTargetAtTime(snap.tremolo.rate, t, tc);
    const depth = snap.tremolo.active ? snap.tremolo.depth : 0;
    lfoDepth.gain.setTargetAtTime(depth / 2, t, tc);
    tremGain.gain.setTargetAtTime(1 - depth / 2, t, tc);
  }

  function panic() { master.gain.setTargetAtTime(0, ctx.currentTime, 0.01); }
  function unmute() { master.gain.setTargetAtTime(1, ctx.currentTime, 0.05); }

  return { apply, panic, unmute, recorderStream: dest.stream };
}
