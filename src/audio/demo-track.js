// A short, loopable demo track rendered offline at runtime.
//
// AirFX's only audio source is an uploaded file, which meant a first-time visitor
// with no music to hand heard nothing at all and reasonably concluded the app was
// broken. Generating the loop rather than shipping an audio file keeps the repo at
// zero binary weight and sidesteps sample licensing entirely.
//
// Deliberately sparse and mid-heavy: a dense mix hides exactly the things the
// effects do. Long note tails make the reverb and delay obvious, and the plucks
// give the low-pass filter something bright to eat.

const BPM = 92;
const BEAT = 60 / BPM;
const BARS = 4;
const DURATION = BEAT * 4 * BARS; // 4/4

// Am - F - C - G, one bar each. Semitone offsets from A2 (55 Hz * 2 = 110).
const A2 = 110;
const PROGRESSION = [
  { root: 0, chord: [0, 3, 7, 12] },   // Am
  { root: -4, chord: [0, 4, 7, 12] },  // F
  { root: 3, chord: [0, 4, 7, 12] },   // C
  { root: -2, chord: [0, 4, 7, 12] },  // G
];

const hz = (semitones) => A2 * Math.pow(2, semitones / 12);

function env(param, t0, peak, attack, decay, sustainLevel, dur) {
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(peak, t0 + attack);
  param.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.0001), t0 + attack + decay);
  param.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function tone(ctx, dest, { freq, t0, dur, type = 'sine', gain = 0.2, attack = 0.01, decay = 0.25 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env(g.gain, t0, gain, attack, decay, gain * 0.35, dur);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function kick(ctx, dest, t0) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t0);
  osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.10);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.75, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.35);
}

export async function renderDemoTrack() {
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr = 44100;
  const ctx = new OfflineCtx(2, Math.ceil(DURATION * sr), sr);

  const bus = ctx.createGain();
  bus.gain.value = 0.5;
  // Roll off the top a little so the generated tones don't sound brittle.
  const tame = ctx.createBiquadFilter();
  tame.type = 'lowpass';
  tame.frequency.value = 5200;
  bus.connect(tame).connect(ctx.destination);

  for (let bar = 0; bar < BARS; bar++) {
    const { root, chord } = PROGRESSION[bar % PROGRESSION.length];
    const barT = bar * 4 * BEAT;

    // Sustained pad: the reverb and delay tail live here.
    for (const iv of chord) {
      tone(ctx, bus, {
        freq: hz(root + iv), t0: barT, dur: BEAT * 3.6,
        type: 'triangle', gain: 0.11, attack: 0.18, decay: 0.9,
      });
    }

    // Bass root on beats 1 and 3.
    for (const b of [0, 2]) {
      tone(ctx, bus, {
        freq: hz(root - 12), t0: barT + b * BEAT, dur: BEAT * 1.4,
        type: 'sine', gain: 0.34, attack: 0.012, decay: 0.5,
      });
    }

    // Off-beat plucks: bright transients for the filter to bite into.
    const arp = [chord[3], chord[1], chord[2], chord[3] + 3];
    arp.forEach((iv, i) => {
      tone(ctx, bus, {
        freq: hz(root + iv + 12), t0: barT + (i * 1 + 0.5) * BEAT, dur: BEAT * 0.85,
        type: 'square', gain: 0.055, attack: 0.004, decay: 0.16,
      });
    });

    kick(ctx, bus, barT);
    kick(ctx, bus, barT + 2 * BEAT);
  }

  const buffer = await ctx.startRendering();
  return URL.createObjectURL(new Blob([encodeWav(buffer)], { type: 'audio/wav' }));
}

// Minimal 16-bit PCM WAV writer — enough for an <audio> src.
function encodeWav(buffer) {
  const chans = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new ArrayBuffer(44 + frames * chans * 2);
  const view = new DataView(bytes);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  str(0, 'RIFF');
  view.setUint32(4, 36 + frames * chans * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, chans, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * chans * 2, true);
  view.setUint16(32, chans * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, frames * chans * 2, true);

  const data = [];
  for (let c = 0; c < chans; c++) data.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chans; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      off += 2;
    }
  }
  return bytes;
}
