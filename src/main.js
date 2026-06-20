import { createAudioEngine } from './audio/audio-engine.js';
import { createRecorder } from './audio/recorder.js';
import { CameraGestureSource } from './gestures/camera-source.js';
import { applyCalibration, DEFAULT_PROFILE } from './calibration/profile.js';
import { OneEuroFilter } from './smoothing/one-euro.js';
import { Debounced, Hysteresis } from './smoothing/debounce.js';
import { mapSignalsToSnapshot } from './mapping/mapping.js';
import { createControlsPanel } from './ui/controls-panel.js';
import { createMeters } from './ui/meters.js';
import { createOverlay } from './ui/overlay.js';
import { SMOOTH, DEBOUNCE, PRESENCE, PRESETS, REVERB, DELAY, TREMOLO } from './config.js';
import { loadProfile, saveProfile, runCalibration } from './calibration/calibration-ui.js';

let profile = DEFAULT_PROFILE;
export const getProfile = () => profile;
export const setProfile = (p) => { profile = p; };

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  REVERB.wetMax = p.reverbWetMax;
  DELAY.feedbackMax = p.delayFeedbackMax;
  TREMOLO.depthMax = p.tremoloDepthMax;
}

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
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera/mic need HTTPS or localhost. Serve over a secure origin.');
    }
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const track0 = audioStream.getAudioTracks()[0];
    const ms = track0 ? track0.getSettings() : {};
    if (ms.echoCancellation || ms.noiseSuppression || ms.autoGainControl) {
      document.getElementById('warn').textContent =
        '🎧 Use headphones. (Browser kept echo/noise processing on – headphones still fix it.)';
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    const engine = createAudioEngine(ctx, audioStream);

    const recorder = createRecorder(engine.recorderStream);
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.addEventListener('click', async () => {
      if (!recorder.active) {
        recorder.start();
        recordBtn.textContent = '■ Stop';
        recordBtn.classList.add('danger');
      } else {
        try {
          const blob = await recorder.stop();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `airfx-take.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
          a.click();
          URL.revokeObjectURL(url);
        } finally {
          recordBtn.textContent = '● Record';
          recordBtn.classList.remove('danger');
        }
      }
    });

    const video = document.getElementById('video');
    const camera = new CameraGestureSource(video);

    const rack = createControlsPanel(document.getElementById('rack'));
    const meters = createMeters(document.getElementById('meters'));
    const overlay = createOverlay(document.getElementById('overlay'), video);

    const leftPipe = makeHandPipeline('left');
    const rightPipe = makeHandPipeline('right');

    // Reveal the stage immediately so the webcam is visible while the hand model loads.
    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;
    const status = document.getElementById('status');
    if (status) status.textContent = 'Starting camera + loading hand model…';

    await camera.init();

    const saved = loadProfile();
    if (saved) profile = saved;
    let latestRaw = null;
    if (status) status.textContent = '';

    camera.start((frame) => {
      latestRaw = frame;
      // FPS sampling
      window.__airfx_fps = window.__airfx_fps || { last: frame.tMs, n: 0, fps: 0 };
      const F = window.__airfx_fps;
      F.n++;
      if (frame.tMs - F.last > 1000) { F.fps = F.n; F.n = 0; F.last = frame.tMs; if (F.fps < 15) console.warn('Low FPS:', F.fps); }
      const signals = { left: leftPipe(frame.left, frame.tMs), right: rightPipe(frame.right, frame.tMs) };
      const snapshot = mapSignalsToSnapshot(signals);
      engine.apply(snapshot);
      rack.update(snapshot);
      meters.update(signals);
      overlay.draw(frame._landmarks || []);
    });

    document.getElementById('panicBtn').addEventListener('click', () => engine.panic());
    document.getElementById('calibrateBtn').addEventListener('click', async () => {
      profile = await runCalibration({ getLatestRaw: () => latestRaw });
    });
    const presetSel = document.getElementById('preset');
    applyPreset(presetSel.value);
    presetSel.addEventListener('change', () => applyPreset(presetSel.value));
    window.__airfx = { ctx, engine, camera, setProfile };
  } catch (e) {
    // Revert to the start screen so the error is visible and retryable.
    document.getElementById('app').hidden = true;
    document.getElementById('startScreen').hidden = false;
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} – ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
