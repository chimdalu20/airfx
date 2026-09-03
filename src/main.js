import { createAudioEngine } from './audio/audio-engine.js';
import { createRecorder } from './audio/recorder.js';
import { CameraGestureSource, ENGINE_NAME } from './gestures/camera-source.js';
import { applyCalibration, DEFAULT_PROFILE } from './calibration/profile.js';
import { OneEuroFilter } from './smoothing/one-euro.js';
import { Hysteresis } from './smoothing/debounce.js';
import { mapSignalsToSnapshot, mapKnobsToSnapshot } from './mapping/mapping.js';
import { createControlsPanel } from './ui/controls-panel.js';
import { createMeters } from './ui/meters.js';
import { createOverlay } from './ui/overlay.js';
import { SMOOTH, PRESENCE, PRESETS, REVERB, DELAY, TREMOLO } from './config.js';
import { loadProfile, saveProfile, runCalibration } from './calibration/calibration-ui.js';
import { createOnboarding } from './ui/onboarding.js';
import { createVoice } from './ui/voice.js';
import { createGrab } from './ui/grab.js';
import { createThemeToggle } from './ui/theme.js';
import { createEngineStatus } from './engine-status.js';
import { renderDemoTrack } from './audio/demo-track.js';

// True on localhost/127.0.0.1/file:, or when the URL carries ?debug.
const DEBUG = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
  || location.protocol === 'file:'
  || new URLSearchParams(location.search).has('debug');

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

// Per-hand pipeline: smoothed height (intensity) + presence. On/off is by click now,
// so there is no open/fist gate here; height holds its last value when a hand leaves frame.
function makeHandPipeline(side) {
  const heightF = new OneEuroFilter(SMOOTH);
  const presence = new Hysteresis(PRESENCE.enter, PRESENCE.exit, false);
  let lastHeight = 0;
  return (obs, tMs) => {
    const present = presence.update(obs ? obs.confidence : 0);
    if (obs) {
      const raw = applyCalibration({ height: obs.height, size: obs.size }, profile[side]);
      lastHeight = heightF.filter(raw.heightNorm, tMs);
    }
    return { present, heightNorm: lastHeight };
  };
}

createThemeToggle(document.getElementById('themeBtn'));
const engineStatus = createEngineStatus(ENGINE_NAME);

const startBtn = document.getElementById('startBtn');
const startError = document.getElementById('startError');

async function start() {
  startError.hidden = true;
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera needs HTTPS or localhost. Serve over a secure origin.');
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    await ctx.resume();
    const voice = createVoice();

    // Audio source is an UPLOADED track (no microphone), routed through the FX graph.
    const trackEl = document.getElementById('track');
    const srcNode = ctx.createMediaElementSource(trackEl);
    const engine = createAudioEngine(ctx, srcNode);

    const trackHint = document.getElementById('trackHint');
    function loadTrack(src, label) {
      trackEl.src = src;
      trackEl.play().catch(() => {});
      if (trackHint) trackHint.textContent = `${label} — raise a hand in front of the camera to hear it change.`;
    }

    const trackFile = document.getElementById('trackFile');
    trackFile.addEventListener('change', () => {
      const file = trackFile.files && trackFile.files[0];
      if (!file) return;
      loadTrack(URL.createObjectURL(file), file.name);
    });

    // Built-in loop, rendered on demand so the page costs nothing until it is asked for.
    const demoBtn = document.getElementById('demoBtn');
    let demoUrl = null;
    demoBtn.addEventListener('click', async () => {
      if (demoUrl) { loadTrack(demoUrl, 'Demo loop'); return; }
      const previous = demoBtn.textContent;
      demoBtn.disabled = true;
      demoBtn.textContent = 'Building loop…';
      try {
        demoUrl = await renderDemoTrack();
        loadTrack(demoUrl, 'Demo loop');
      } catch (err) {
        if (trackHint) trackHint.textContent = `Could not build the demo loop: ${err.message}`;
      } finally {
        demoBtn.disabled = false;
        demoBtn.textContent = previous;
      }
    });

    const recorder = createRecorder(engine.recorderStream);
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.addEventListener('click', async () => {
      if (!recorder.active) {
        recorder.start();
        recordBtn.textContent = 'Stop';
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
          recordBtn.textContent = 'Record';
          recordBtn.classList.remove('danger');
        }
      }
    });

    const video = document.getElementById('video');
    const camera = new CameraGestureSource(video);

    const rack = createControlsPanel(
      document.getElementById('rackLeft'),
      document.getElementById('rackRight'),
    );
    const meters = createMeters(document.getElementById('meters'));
    const overlay = createOverlay(document.getElementById('overlay'), video);
    const grab = createGrab({ rack });
    let mode = 'air'; // 'air' = hand-height intensity; 'grab' = virtual hands grab knobs

    const leftPipe = makeHandPipeline('left');
    const rightPipe = makeHandPipeline('right');

    // Reveal the stage immediately so the webcam is visible while the hand model loads.
    document.getElementById('startScreen').hidden = true;
    document.getElementById('app').hidden = false;
    const status = document.getElementById('status');
    if (status) status.textContent = `Starting camera · loading the ${ENGINE_NAME} engine…`;

    // These controls touch only the audio engine and the DOM, never the camera, so
    // they are wired before the hand model downloads. Wiring them afterwards left
    // Mute, Calibrate, the mode toggle and the preset inert for several seconds
    // with nothing on screen saying so.
    let latestRaw = null;
    let fpsState = null;
    // Mute used to be one-way: it called panic() and nothing ever called unmute(),
    // so a single click silenced the app until reload. It is a toggle now.
    const panicBtn = document.getElementById('panicBtn');
    let muted = false;
    panicBtn.addEventListener('click', () => {
      muted = !muted;
      if (muted) engine.panic(); else engine.unmute();
      panicBtn.textContent = muted ? 'Unmute' : 'Mute';
      panicBtn.classList.toggle('on', muted);
      panicBtn.setAttribute('aria-pressed', String(muted));
    });
    document.getElementById('calibrateBtn').addEventListener('click', async () => {
      profile = await runCalibration({ getLatestRaw: () => latestRaw, voice });
    });
    const presetSel = document.getElementById('preset');
    applyPreset(presetSel.value);
    presetSel.addEventListener('change', () => applyPreset(presetSel.value));

    function setMode(m) {
      mode = m;
      grab.setActive(m === 'grab');
      document.getElementById('modeAir').classList.toggle('on', m === 'air');
      document.getElementById('modeGrab').classList.toggle('on', m === 'grab');
    }
    document.getElementById('modeAir').addEventListener('click', () => setMode('air'));
    document.getElementById('modeGrab').addEventListener('click', () => setMode('grab'));

    // Console debug handle: local dev or an explicit ?debug, never on the public build.
    if (DEBUG) window.__airfx = { ctx, engine, camera, setProfile };

    // The tour opens NOW, before the engine download, so the wait is spent learning the app
    // instead of watching a still frame. Steps that need tracking name the engine and wait
    // for it; every other step is usable immediately.
    const onboarding = createOnboarding({
      voice,
      engine: engineStatus,
      onCalibrate: async () => { profile = await runCalibration({ getLatestRaw: () => latestRaw, voice }); },
    });
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) helpBtn.addEventListener('click', () => onboarding.start());
    if (onboarding.isFirstRun()) onboarding.start();

    try {
      await camera.init();
    } catch (err) {
      // Send the user back to the start screen without burning their first-run tour.
      engineStatus.fail(err);
      onboarding.abort();
      throw err;
    }

    const saved = loadProfile();
    if (saved) profile = saved;
    if (status) status.textContent = '';

    const debugEl = document.getElementById('debug');
    camera.start((frame) => {
      latestRaw = frame;
      // FPS sampling
      if (!fpsState) fpsState = { last: frame.tMs, n: 0, fps: 0 };
      const F = fpsState;
      F.n++;
      if (frame.tMs - F.last > 1000) { F.fps = F.n; F.n = 0; F.last = frame.tMs; }
      const hands = (frame._landmarks || []).length;
      if (debugEl) {
        debugEl.classList.toggle('err', !!frame._error);
        const detail = DEBUG ? ` · ${F.fps || '…'} fps` : '';
        debugEl.textContent = frame._error
          ? frame._error
          : hands === 0
            ? 'No hands detected — hold a hand up, palm to the camera'
            : `Tracking ${hands} hand${hands > 1 ? 's' : ''}${detail}`;
        debugEl.classList.toggle('waiting', !frame._error && hands === 0);
      }
      try {
        const signals = { left: leftPipe(frame.left, frame.tMs), right: rightPipe(frame.right, frame.tMs) };
        meters.update(signals);
        let snapshot;
        if (mode === 'grab') {
          grab.update(frame);
          snapshot = mapKnobsToSnapshot(grab.getValues(), rack.getEnabled());
        } else {
          snapshot = mapSignalsToSnapshot(signals, rack.getEnabled());
        }
        engine.apply(snapshot);
        rack.update(snapshot);
        overlay.draw(frame._landmarks || []);
      } catch (err) {
        if (debugEl) { debugEl.classList.add('err'); debugEl.textContent = `render: ${err.message}`; }
        console.error(err);
      }
    });

    // Ready means frames are actually being delivered, not merely that init() resolved.
    engineStatus.ready();

  } catch (e) {
    // Revert to the start screen so the error is visible and retryable.
    document.getElementById('app').hidden = true;
    document.getElementById('startScreen').hidden = false;
    startError.hidden = false;
    startError.textContent = `Could not start: ${e.name} – ${e.message}`;
  }
}

startBtn.addEventListener('click', start);
