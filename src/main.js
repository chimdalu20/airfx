import { createAudioEngine } from './audio/audio-engine.js';

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
