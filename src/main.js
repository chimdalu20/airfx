import { createAudioEngine } from './audio/audio-engine.js';
import { CameraGestureSource } from './gestures/camera-source.js';
import { applyCalibration, DEFAULT_PROFILE } from './calibration/profile.js';
import { OneEuroFilter } from './smoothing/one-euro.js';
import { Debounced, Hysteresis } from './smoothing/debounce.js';
import { mapSignalsToSnapshot } from './mapping/mapping.js';
import { createControlsPanel } from './ui/controls-panel.js';
import { createMeters } from './ui/meters.js';
import { createOverlay } from './ui/overlay.js';
import { SMOOTH, DEBOUNCE, PRESENCE } from './config.js';

let profile = DEFAULT_PROFILE;
export const getProfile = () => profile;
export const setProfile = (p) => { profile = p; };

function makeHandPipeline(side) {
  const heightF = new OneEuroFilter(SMOOTH);
  const distF = new OneEuroFilter(SMOOTH);
  const fingers = new Debounced(DEBOUNCE.fingerFrames, 0);
  const presence = new Hysteresis(PRESENCE.enter, PRESENCE.exit, false);
  let lastNorm = { heightNorm: 0, distanceNorm: 0 };
  return (obs, tMs) => {
    const present = presence.update(obs ? obs.confidence : 0);
    if (obs) {
      const raw = applyCalibration({ height: obs.height, size: obs.size }, profile[side]);
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

    const video = document.getElementById('video');
    const camera = new CameraGestureSource(video);
    await camera.init();

    const rack = createControlsPanel(document.getElementById('rack'));
    const meters = createMeters(document.getElementById('meters'));
    const overlay = createOverlay(document.getElementById('overlay'), video);

    const leftPipe = makeHandPipeline('left');
    const rightPipe = makeHandPipeline('right');

    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;

    camera.start((frame) => {
      const signals = { left: leftPipe(frame.left, frame.tMs), right: rightPipe(frame.right, frame.tMs) };
      const snapshot = mapSignalsToSnapshot(signals);
      engine.apply(snapshot);
      rack.update(snapshot);
      meters.update(signals);
      overlay.draw(frame._landmarks || []);
    });

    document.getElementById('panicBtn').addEventListener('click', () => engine.panic());
    window.__airfx = { ctx, engine, camera, setProfile };
  } catch (e) {
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} – ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
