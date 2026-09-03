import { DEFAULT_PROFILE } from './profile.js';

const KEY = 'airfx.calibration';

export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function saveProfile(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

// Calibrate each hand's high/low reach (intensity = hand height).
//
// This used to be a centred modal over a full-screen scrim, which covered and dimmed the
// camera feed — the one thing you need to see while aiming. You were asked to hold a hand
// "HIGH" with no way to tell whether it was in frame, how high it actually was, or which
// side of the picture it belonged on. The only feedback was an abstract "detected: 65%".
//
// Now the panel sits BELOW the stage and the guidance is drawn ON the video: a live line at
// your current hand height, a marker for the furthest you have reached this step, and a
// shaded half showing which side of the frame this hand is read from.
//
// The guide is DOM inside .stage, not the overlay canvas: that canvas is scaleX(-1) mirrored,
// so any text drawn on it would come out backwards.

const STEPS = [
  { side: 'left', field: 'heightHigh', dir: 'up', text: 'Open your LEFT hand and reach UP as high as is comfortable' },
  { side: 'left', field: 'heightLow', dir: 'down', text: 'Now lower your LEFT hand as far DOWN as is comfortable' },
  { side: 'right', field: 'heightHigh', dir: 'up', text: 'Open your RIGHT hand and reach UP as high as is comfortable' },
  { side: 'right', field: 'heightLow', dir: 'down', text: 'Now lower your RIGHT hand as far DOWN as is comfortable' },
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

    // Live guidance drawn over the video itself.
    const guide = document.createElement('div');
    guide.className = 'cal-guide-layer';
    guide.innerHTML = `
      <div class="cal-half"></div>
      <div class="cal-side-tag"></div>
      <div class="cal-peak"><span class="cal-peak-tag"></span></div>
      <div class="cal-now"><span class="cal-now-tag"></span></div>
      <div class="cal-nohand">Hold your hand up on this side of the picture</div>`;
    stage?.appendChild(guide);

    // Instruction panel, placed under the stage so the picture stays clear.
    const panel = document.createElement('div');
    panel.className = 'cal-panel';
    panel.innerHTML = `
      <div class="cal-head">
        <span class="cal-step"></span>
        <button class="cal-skip ghost" type="button">Skip calibration</button>
      </div>
      <p class="cal-text"></p>
      <p class="cal-sub">Watch the line on the camera — it follows your hand. Reach as far as you
        comfortably can, hold it, then capture.</p>
      <div class="cal-actions">
        <button class="cal-capture" type="button" disabled>Capture</button>
        <span class="cal-live"></span>
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
      capture: panel.querySelector('.cal-capture'),
      half: guide.querySelector('.cal-half'),
      sideTag: guide.querySelector('.cal-side-tag'),
      now: guide.querySelector('.cal-now'),
      nowTag: guide.querySelector('.cal-now-tag'),
      warn: panel.querySelector('.cal-warn'),
      warnText: panel.querySelector('.cal-warn-text'),
      peak: guide.querySelector('.cal-peak'),
      peakTag: guide.querySelector('.cal-peak-tag'),
      noHand: guide.querySelector('.cal-nohand'),
    };

    let i = 0;
    let raf = 0;
    let peak = null;   // furthest reach seen during this step
    let latest = null; // last observed height this step

    function render() {
      const s = STEPS[i];
      peak = null;
      latest = null;
      els.step.textContent = `Calibrate · step ${i + 1} of ${STEPS.length}`;
      els.text.textContent = s.text;
      els.capture.disabled = true;
      els.capture.textContent = 'Capture';
      els.live.textContent = '';
      guide.dataset.dir = s.dir;
      guide.dataset.side = s.side;
      els.sideTag.textContent = `${s.side} hand`;
      els.peak.hidden = true;
      els.now.hidden = true;
      els.noHand.hidden = false;
      els.warn.hidden = true;
      panel.classList.remove('warning');
      voice?.speak(s.text);
    }

    function tick() {
      const s = STEPS[i];
      const obs = getLatestRaw?.()?.[s.side];

      if (obs) {
        latest = obs.height;
        // Peak is the furthest in the direction being calibrated.
        peak = peak === null ? latest : (s.dir === 'up' ? Math.max(peak, latest) : Math.min(peak, latest));

        els.noHand.hidden = true;
        els.now.hidden = false;
        els.peak.hidden = false;
        els.now.style.bottom = `${Math.max(0, Math.min(1, latest)) * 100}%`;
        els.peak.style.bottom = `${Math.max(0, Math.min(1, peak)) * 100}%`;
        els.nowTag.textContent = `now ${pct(latest)}`;
        els.peakTag.textContent = `${s.dir === 'up' ? 'highest' : 'lowest'} ${pct(peak)}`;
        // At the peak, the live line and the marker coincide — say so.
        guide.classList.toggle('at-peak', Math.abs(latest - peak) < 0.01);

        els.capture.disabled = false;
        els.capture.textContent = `Capture ${pct(peak)}`;
        els.live.textContent = `captures your ${s.dir === 'up' ? 'highest' : 'lowest'} reach so far`;
      } else {
        els.noHand.hidden = false;
        els.now.hidden = true;
        els.capture.disabled = true;
        els.capture.textContent = 'Capture';
        els.live.textContent = 'No hand detected on that side of the picture.';
      }
      raf = requestAnimationFrame(tick);
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

    function advance() {
      if (++i >= STEPS.length) close(true);
      else render();
    }

    els.capture.addEventListener('click', () => {
      const s = STEPS[i];
      // Record the furthest reach, not the instant the button was pressed — pressing it
      // necessarily drops your hand a little.
      const value = peak !== null ? peak : latest;
      if (value !== null) profile[s.side][s.field] = value;

      // After the second step of a hand, check the two captures actually span a range.
      if (s.dir === 'down') {
        const cal = profile[s.side];
        const span = Math.abs(cal.heightHigh - cal.heightLow);
        if (span < MIN_SPAN) {
          els.warnText.textContent =
            `Your ${s.side} hand's high and low are only ${pct(span)} apart. That is too close `
            + `to control anything — this hand would barely respond. Redo it, reaching further `
            + `apart, or keep it as it is.`;
          els.warn.hidden = false;
          panel.classList.add('warning');
          els.capture.disabled = true;
          return; // wait for Redo / Use it anyway
        }
      }
      advance();
    });

    panel.querySelector('.cal-redo').addEventListener('click', () => {
      i -= 1;               // back to this hand's first (up) step
      render();
    });
    panel.querySelector('.cal-continue').addEventListener('click', () => {
      els.warn.hidden = true;
      panel.classList.remove('warning');
      advance();
    });
    panel.querySelector('.cal-skip').addEventListener('click', () => close(false));

    render();
    tick();
  });
}
