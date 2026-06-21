// First-run guided tour. Mirrors the real flow (calibrate -> load -> left hand -> right
// hand -> toggle), one job per step, with an animated hand-guide over the camera, a
// spotlight on the real control, Next/Back/Skip on every step, and a phase-jump.
// Idempotent: only sets the `airfx.onboarded` flag; never touches audio/profile state.

const STEPS = [
  { phase: 'Welcome', title: '👋 Meet AirFX', body: 'Upload a track and bend its sound with your hands in the air — like conducting effects. About 30 seconds to set up.' },

  { phase: 'Calibrate', title: 'First, your reach', body: 'I’ll learn how high and low your hands go, so lifting a hand means “more effect.”', target: '#calibrateBtn', guide: { side: 'left' } },
  { phase: 'Calibrate', title: 'Calibrate now', body: 'You’ll move each open hand HIGH, then LOW. Tap the button and follow the live guide.', target: '#calibrateBtn', cta: 'Start calibration', action: 'calibrate' },
  { phase: 'Calibrate', title: 'Range locked in ✓', body: 'Now you only need to reach about three-quarters of the way up for the full effect.' },

  { phase: 'Track', title: 'Load some music', body: 'Tap Upload and pick any audio file — it loops so you can keep jamming.', target: '.upload' },
  { phase: 'Track', title: '🎵 Now it’s live', body: 'Everything you hear from here on is shaped by your hands in real time.', target: '.transport' },

  { phase: 'Left hand', title: 'Left hand = tone', body: 'Your LEFT hand runs Filter, Reverb and Delay — these three cards on the left.', target: '.col-left' },
  { phase: 'Left hand', title: 'Lift your left hand', body: 'Open your left hand on the LEFT of the view and slowly raise it.', target: '.stage', guide: { side: 'left' } },
  { phase: 'Left hand', title: 'Hear it open up?', body: 'The arcs fill as you rise and settle as you lower — that’s all you, live.', target: '.col-left' },

  { phase: 'Right hand', title: 'Right hand = tremolo', body: 'Open your RIGHT hand on the right and raise it for a pulsing wobble.', target: '.stage', guide: { side: 'right' } },
  { phase: 'Right hand', title: 'That pulse is tremolo', body: 'The higher you go, the faster and deeper it pulses.', target: '.col-right' },

  { phase: 'Toggle', title: 'Switch effects on/off', body: 'Tap any effect card to toggle it — perfect for dropping reverb in and out.', target: '.col-left .fx' },

  { phase: 'Done', title: 'You’re ready 🎚️', body: 'Presets change the vibe · Record saves a take · Mute is your panic button · tap “? Tour” to replay this anytime.', target: '.actions', last: true },
];

const FLAG = 'airfx.onboarded';

export function createOnboarding({ onCalibrate } = {}) {
  let root = null;
  let i = 0;
  const phases = [...new Set(STEPS.map((s) => s.phase))];
  const firstIndexOf = (phase) => STEPS.findIndex((s) => s.phase === phase);

  function build() {
    root = document.createElement('div');
    root.className = 'ob-root';
    root.innerHTML = `
      <div class="ob-spot"></div>
      <div class="ob-hand" hidden><span class="ob-arrow">▲</span>✋<span class="ob-arrow">▼</span></div>
      <div class="ob-card">
        <div class="ob-dots"></div>
        <h3 class="ob-title"></h3>
        <p class="ob-body"></p>
        <div class="ob-cta"></div>
        <div class="ob-nav">
          <button class="ob-back ghost">Back</button>
          <button class="ob-next">Next</button>
        </div>
        <button class="ob-exit ghost">Skip tour</button>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.ob-back').addEventListener('click', () => go(i - 1));
    root.querySelector('.ob-next').addEventListener('click', () => (STEPS[i].last ? finish() : go(i + 1)));
    root.querySelector('.ob-exit').addEventListener('click', finish);
    const dots = root.querySelector('.ob-dots');
    phases.forEach((p) => {
      const d = document.createElement('button');
      d.className = 'ob-dot';
      d.title = p;
      d.addEventListener('click', () => go(firstIndexOf(p)));
      dots.appendChild(d);
    });
    window.addEventListener('resize', reposition);
  }

  function spotlight(rect) {
    const spot = root.querySelector('.ob-spot');
    if (!rect) { spot.style.cssText = 'left:50%;top:50%;width:0;height:0;'; return; }
    const pad = 8;
    spot.style.cssText = `left:${rect.left - pad}px;top:${rect.top - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px;`;
  }

  function placeCard(rect) {
    const card = root.querySelector('.ob-card');
    if (!rect) { card.style.left = '50%'; card.style.top = '50%'; card.style.transform = 'translate(-50%,-50%)'; return; }
    card.style.transform = 'none';
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const m = 12;
    let top = rect.bottom + m;
    if (top + ch > window.innerHeight - m) top = rect.top - ch - m; // flip above the target
    top = Math.max(m, Math.min(top, window.innerHeight - ch - m));
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - cw - m));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function showHand(guide) {
    const hand = root.querySelector('.ob-hand');
    const stage = document.querySelector('.stage');
    if (!guide || !stage) { hand.hidden = true; return; }
    const r = stage.getBoundingClientRect();
    hand.hidden = false;
    hand.style.top = `${r.top}px`;
    hand.style.height = `${r.height}px`;
    hand.style.left = `${guide.side === 'right' ? r.left + r.width * 0.72 : r.left + r.width * 0.28}px`;
  }

  function render() {
    const s = STEPS[i];
    root.querySelector('.ob-title').textContent = s.title;
    root.querySelector('.ob-body').textContent = s.body;
    root.querySelector('.ob-back').disabled = i === 0;
    root.querySelector('.ob-next').textContent = s.last ? 'Finish' : 'Next';
    root.querySelectorAll('.ob-dot').forEach((d, n) => d.classList.toggle('on', phases[n] === s.phase));

    const cta = root.querySelector('.ob-cta');
    cta.innerHTML = '';
    if (s.cta) {
      const b = document.createElement('button');
      b.className = 'ob-ctabtn';
      b.textContent = s.cta;
      b.addEventListener('click', () => runAction(s));
      cta.appendChild(b);
    }
    reposition();
    showHand(s.guide);
  }

  function reposition() {
    if (!root) return;
    const s = STEPS[i];
    const el = s.target ? document.querySelector(s.target) : null;
    const rect = el ? el.getBoundingClientRect() : null;
    spotlight(rect);
    placeCard(rect);
    showHand(s.guide);
  }

  async function runAction(s) {
    if (s.action === 'calibrate' && onCalibrate) {
      root.style.display = 'none'; // step aside so the calibration overlay is unobstructed
      try { await onCalibrate(); } finally { root.style.display = ''; }
      go(i + 1);
    }
  }

  function go(n) {
    i = Math.max(0, Math.min(STEPS.length - 1, n));
    render();
  }

  function finish() {
    localStorage.setItem(FLAG, '1');
    if (root) { window.removeEventListener('resize', reposition); root.remove(); root = null; }
  }

  function start() {
    if (root) finish();
    build();
    go(0);
  }

  return { start, isFirstRun: () => !localStorage.getItem(FLAG) };
}
