import { createAudioEngine } from './audio/audio-engine.js';
import { applyCalibration, DEFAULT_PROFILE } from './calibration/profile.js';
import { OneEuroFilter } from './smoothing/one-euro.js';
import { Debounced, Hysteresis } from './smoothing/debounce.js';
import { mapSignalsToSnapshot } from './mapping/mapping.js';
import { SMOOTH, DEBOUNCE, PRESENCE } from './config.js';

function makeHandPipeline(side, getProfile) {
  const heightF = new OneEuroFilter(SMOOTH);
  const distF = new OneEuroFilter(SMOOTH);
  const fingers = new Debounced(DEBOUNCE.fingerFrames, 0);
  const presence = new Hysteresis(PRESENCE.enter, PRESENCE.exit, false);
  let lastNorm = { heightNorm: 0, distanceNorm: 0 };
  return (obs, tMs) => {
    const present = presence.update(obs ? obs.confidence : 0);
    if (obs) {
      const cal = getProfile()[side];
      const raw = applyCalibration({ height: obs.height, size: obs.size }, cal);
      lastNorm = {
        heightNorm: heightF.filter(raw.heightNorm, tMs),
        distanceNorm: distF.filter(raw.distanceNorm, tMs),
      };
    }
    const out = { present, heightNorm: lastNorm.heightNorm, distanceNorm: lastNorm.distanceNorm };
    if (side === 'left') out.fingers = present ? fingers.push(obs ? obs.fingers : 0) : 0;
    return out;
  };
}

function createSignalPipeline(getProfile) {
  const left = makeHandPipeline('left', getProfile);
  const right = makeHandPipeline('right', getProfile);
  return (frame) => ({
    left: left(frame.left, frame.tMs),
    right: right(frame.right, frame.tMs),
  });
}

const startBtn = document.getElementById('startBtn');
const startError = document.getElementById('startError');

async function start() {
  startError.hidden = true;
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    const engine = createAudioEngine(ctx, audioStream);
    // Idle passthrough: filter open, no effects.
    engine.apply({
      filter: { cutoff: 12000, q: 1 },
      reverb: { wet: 0, active: false },
      delay: { mix: 0, time: 0.28, feedback: 0, active: false },
      tremolo: { rate: 5, depth: 0, active: false },
    });
    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;
    window.__airfx = { ctx, engine }; // dev handle for next tasks
    const settings = audioStream.getAudioTracks()[0].getSettings();
    console.log('mic settings (verify AEC/NS/AGC off):', settings);
  } catch (e) {
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} – ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
