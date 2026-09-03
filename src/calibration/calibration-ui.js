import { DEFAULT_PROFILE } from './profile.js';
import {
  TARGETS, targetKey, handAnchor, handFitsTarget, fitCloseness, buildGhostHandSvg,
  ANCHOR_IN_BOX, HIT_RADIUS,
} from './hand-target.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// Calibrate each hand's high/low reach by AIMING, not by self-reporting.
//
// Two earlier versions failed for the same underlying reason: the user was asked to judge
// their own position with nothing to judge it against. First it was a modal that covered
// the camera entirely; then the camera was visible but the only target was the words "reach
// as high as is comfortable" and a faint half-frame tint, which is invisible against a real,
// brightly lit room.
//
// Now each step draws a ghost hand where the hand should go. Put your hand in it, hold
// briefly, and the step captures itself — so there is no Capture button, and therefore none
// of the bias from pressing one (reaching for a button drags your hand out of position).
// The ghost is the same 21-point skeleton the live overlay draws, so "fits the outline"
// is literally the two shapes overlapping.

const HOLD_MS = 1100;        // how long the hand must stay in the target
const STUCK_MS = 9000;       // after this long stuck outside, offer a manual escape

const STEPS = [
  { side: 'left', field: 'heightHigh', dir: 'up', text: 'Put your LEFT hand in the outline, up high' },
  { side: 'left', field: 'heightLow', dir: 'down', text: 'Now your LEFT hand in the lower outline' },
  { side: 'right', field: 'heightHigh', dir: 'up', text: 'Put your RIGHT hand in the outline, up high' },
  { side: 'right', field: 'heightLow', dir: 'down', text: 'Now your RIGHT hand in the lower outline' },
];

const pct = (v) => `${Math.round(v * 100)}%`;
// Below this, high and low are close enough that normalize() collapses the hand to a
// constant — it would be silently dead for the whole session with no error anywhere.
const MIN_SPAN = 0.10;

export function runCalibration({ getLatestRaw, voice }) {
  return new Promise((resolve) => {
    const profile = structuredClone(loadProfile() || DEFAULT_PROFILE);
    const stage = document.querySelector('.stage');
    const column = stage?.parentElement;

    const guide = document.createElement('div');
    guide.className = 'cal-guide-layer';
    guide.innerHTML = `
      <div class="cal-dim"></div>
      <div class="cal-divider"></div>
      <div class="cal-side-tag"></div>
      <div class="cal-target">
        <svg class="cal-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="cal-ring-track" cx="50" cy="50" r="47" pathLength="100" />
          <circle class="cal-ring-fill" cx="50" cy="50" r="47" pathLength="100" />
        </svg>
      </div>
      <div class="cal-ghost">${buildGhostHandSvg()}</div>
      <div class="cal-demo">${buildGhostHandSvg()}</div>
      <div class="cal-hud"></div>`;
    stage?.appendChild(guide);

    const panel = document.createElement('div');
    panel.className = 'cal-panel';
    panel.innerHTML = `
      <div class="cal-head">
        <span class="cal-step"></span>
        <button class="cal-skip ghost" type="button">Skip calibration</button>
      </div>
      <p class="cal-text"></p>
      <p class="cal-sub">Move your hand into the outline on the camera and hold still — it
        captures on its own.</p>
      <div class="cal-actions">
        <span class="cal-live"></span>
        <button class="cal-manual ghost" type="button" hidden>Can’t reach it — use where my hand is</button>
      </div>
      <div class="cal-warn" hidden>
        <p class="cal-warn-text"></p>
        <div class="cal-warn-actions">
          <button class="cal-redo" type="button">Redo this hand</button>
          <button class="cal-continue ghost" type="button">Use it anyway</button>
        </div>
      </div>`;
    if (column && stage) column.insertBefore(panel, stage.nextSibling);
    else document.body.appendChild(panel);

    document.body.classList.add('calibrating');
    stage?.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const els = {
      step: panel.querySelector('.cal-step'),
      text: panel.querySelector('.cal-text'),
      live: panel.querySelector('.cal-live'),
      manual: panel.querySelector('.cal-manual'),
      warn: panel.querySelector('.cal-warn'),
      warnText: panel.querySelector('.cal-warn-text'),
      ghost: guide.querySelector('.cal-ghost'),
      demo: guide.querySelector('.cal-demo'),
      target: guide.querySelector('.cal-target'),
      ringFill: guide.querySelector('.cal-ring-fill'),
      sideTag: guide.querySelector('.cal-side-tag'),
      hud: guide.querySelector('.cal-hud'),
    };

    let i = 0;
    let raf = 0;
    let holdStart = null;   // when the hand entered the target
    let samples = [];       // heights collected during the hold
    let stepStart = 0;
    let latestHeight = null;
    let paused = false;     // true while the degenerate-range warning is up

    function positionGhost(t) {
      // All three are placed ON the target point. The ring is centred on it; the ghost and
      // the moving demo hand are offset so their OWN anchor (landmark 9, the point that is
      // hit-tested) lands there. The offset is published as CSS variables so the demo's
      // keyframes stay in sync with the static ghost automatically.
      for (const el of [els.ghost, els.target, els.demo]) {
        el.style.left = `${t.x * 100}%`;
        el.style.top = `${t.y * 100}%`;
      }
      guide.style.setProperty('--anchor-x', `-${(ANCHOR_IN_BOX.x * 100).toFixed(2)}%`);
      guide.style.setProperty('--anchor-y', `-${(ANCHOR_IN_BOX.y * 100).toFixed(2)}%`);
      // The ring is drawn at the true tolerance, so what you see is what is tested.
      els.target.style.width = `${HIT_RADIUS * 2 * 100}%`;
    }

    function setProgress(p) {
      els.ringFill.style.strokeDasharray = `${(p * 100).toFixed(1)} 100`;
    }

    function render() {
      const s = STEPS[i];
      holdStart = null;
      samples = [];
      stepStart = performance.now();
      latestHeight = null;
      els.step.textContent = `Calibrate · step ${i + 1} of ${STEPS.length}`;
      els.text.textContent = s.text;
      els.live.textContent = '';
      els.manual.hidden = true;
      els.warn.hidden = true;
      panel.classList.remove('warning');
      guide.dataset.dir = s.dir;
      guide.dataset.side = s.side;
      guide.classList.remove('in-target');
      guide.classList.add('demo-on');
      els.sideTag.textContent = `${s.side} hand`;
      positionGhost(TARGETS[targetKey(s.side, s.dir)]);
      setProgress(0);
      els.hud.textContent = '';
      voice?.speak(s.text);
    }

    function commit(value) {
      const s = STEPS[i];
      profile[s.side][s.field] = value;

      if (s.dir === 'down') {
        const cal = profile[s.side];
        const span = Math.abs(cal.heightHigh - cal.heightLow);
        if (span < MIN_SPAN) {
          els.warnText.textContent =
            `Your ${s.side} hand's high and low are only ${pct(span)} apart. That is too close `
            + `to control anything — this hand would barely respond. Redo it, or keep it as it is.`;
          els.warn.hidden = false;
          panel.classList.add('warning');
          paused = true;
          return;
        }
      }
      advance();
    }

    function advance() {
      paused = false;
      if (++i >= STEPS.length) close(true);
      else render();
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      if (paused) return;

      const s = STEPS[i];
      const target = TARGETS[targetKey(s.side, s.dir)];
      const obs = getLatestRaw?.()?.[s.side];
      const anchor = obs ? handAnchor(obs.lm) : null;
      const aspect = stage && stage.clientHeight
        ? stage.clientWidth / stage.clientHeight
        : 16 / 9;

      if (!obs || !anchor) {
        holdStart = null;
        samples = [];
        guide.classList.remove('in-target');
        guide.classList.add('demo-on');
        setProgress(0);
        els.hud.textContent = `Raise your ${s.side} hand`;
        els.live.textContent = 'No hand detected on that side of the picture.';
        return;
      }

      latestHeight = obs.height;
      const inside = handFitsTarget(anchor, target, aspect);
      guide.classList.toggle('in-target', inside);
      guide.classList.toggle('demo-on', !inside);

      if (inside) {
        if (holdStart === null) { holdStart = performance.now(); samples = []; }
        samples.push(obs.height);
        const held = performance.now() - holdStart;
        setProgress(Math.min(1, held / HOLD_MS));
        els.hud.textContent = 'Hold still…';
        els.live.textContent = 'Holding — keep still.';
        if (held >= HOLD_MS) {
          // Average the hold rather than taking the last frame: steadier, and it cannot be
          // skewed by the frame where the hand starts to leave.
          const value = samples.reduce((a, b) => a + b, 0) / samples.length;
          holdStart = null;
          samples = [];
          setProgress(0);
          els.hud.textContent = `Captured ${pct(value)}`;
          commit(value);
        }
        return;
      }

      holdStart = null;
      samples = [];
      setProgress(0);
      const near = fitCloseness(anchor, target, aspect) > 0;
      els.hud.textContent = near ? 'Almost — a little more' : 'Move into the outline';
      els.live.textContent = `Your hand is at ${pct(obs.height)}. Move it into the outline.`;
      // Never trap someone whose camera framing or reach cannot meet the target.
      if (performance.now() - stepStart > STUCK_MS) els.manual.hidden = false;
    }

    function close(save) {
      voice?.cancel();
      cancelAnimationFrame(raf);
      guide.remove();
      panel.remove();
      document.body.classList.remove('calibrating');
      if (save) saveProfile(profile);
      resolve(save ? profile : (loadProfile() || DEFAULT_PROFILE));
    }

    els.manual.addEventListener('click', () => {
      if (latestHeight !== null) commit(latestHeight);
    });
    panel.querySelector('.cal-skip').addEventListener('click', () => close(false));
    panel.querySelector('.cal-redo').addEventListener('click', () => {
      paused = false;
      i -= 1;               // back to this hand's first step
      render();
    });
    panel.querySelector('.cal-continue').addEventListener('click', () => {
      els.warn.hidden = true;
      panel.classList.remove('warning');
      advance();
    });

    render();
    tick();
  });
}
