import { DEFAULT_PROFILE } from './profile.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// Calibrate each hand's high/low reach (intensity = hand height). Friendly in-app overlay
// with a live height readout + an animated guide, instead of blocking window.alert prompts.
const STEPS = [
  { side: 'left', field: 'heightHigh', dir: 'up', text: 'Open your LEFT hand and hold it HIGH' },
  { side: 'left', field: 'heightLow', dir: 'down', text: 'Now lower your LEFT hand DOWN' },
  { side: 'right', field: 'heightHigh', dir: 'up', text: 'Open your RIGHT hand and hold it HIGH' },
  { side: 'right', field: 'heightLow', dir: 'down', text: 'Now lower your RIGHT hand DOWN' },
];

// getLatestRaw() returns the most recent RawFrame ({ left, right } each with .height).
export function runCalibration({ getLatestRaw, voice }) {
  return new Promise((resolve) => {
    const profile = structuredClone(loadProfile() || DEFAULT_PROFILE);
    const root = document.createElement('div');
    root.className = 'cal-overlay';
    root.innerHTML = `
      <div class="cal-card">
        <div class="cal-step"></div>
        <div class="cal-guide"><span class="cal-arrow">▲</span><span class="cal-hand">✋</span></div>
        <p class="cal-text"></p>
        <div class="cal-live">detected: <b class="cal-val">show your hand…</b></div>
        <div class="cal-actions">
          <button class="cal-capture" disabled>Capture</button>
          <button class="cal-skip ghost">Skip</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const els = {
      step: root.querySelector('.cal-step'),
      guide: root.querySelector('.cal-guide'),
      text: root.querySelector('.cal-text'),
      val: root.querySelector('.cal-val'),
      capture: root.querySelector('.cal-capture'),
    };
    let i = 0;
    let raf = 0;

    function render() {
      const s = STEPS[i];
      els.step.textContent = `Calibrate · ${i + 1} / ${STEPS.length}`;
      els.text.textContent = s.text;
      els.guide.dataset.dir = s.dir;
      voice?.speak(s.text);
    }
    function tick() {
      const obs = getLatestRaw?.()?.[STEPS[i].side];
      els.val.textContent = obs ? `${Math.round(obs.height * 100)}%` : 'show your hand…';
      els.capture.disabled = !obs;
      raf = requestAnimationFrame(tick);
    }
    function close(save) {
      voice?.cancel();
      cancelAnimationFrame(raf);
      root.remove();
      if (save) saveProfile(profile);
      resolve(save ? profile : (loadProfile() || DEFAULT_PROFILE));
    }
    els.capture.addEventListener('click', () => {
      const s = STEPS[i];
      const obs = getLatestRaw?.()?.[s.side];
      if (obs) profile[s.side][s.field] = obs.height;
      if (++i >= STEPS.length) close(true);
      else render();
    });
    root.querySelector('.cal-skip').addEventListener('click', () => close(false));
    render();
    tick();
  });
}
