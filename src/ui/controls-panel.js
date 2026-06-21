import { snapshotToDisplay, valueToAngle } from './knob-geometry.js';
import { KNOB } from '../config.js';

// Pure: snapshot -> per-knob angles (degrees) + active flags. Unit-tested.
export function computeDialAngles(snapshot) {
  const d = snapshotToDisplay(snapshot);
  const a = (v) => valueToAngle(v, KNOB.sweepDeg);
  return {
    filter: { cutoff: a(d.filter.cutoff), active: true },
    reverb: { wet: a(d.reverb.wet), active: d.reverb.active },
    delay: { mix: a(d.delay.mix), feedback: a(d.delay.feedback), active: d.delay.active },
    tremolo: { rate: a(d.tremolo.rate), depth: a(d.tremolo.depth), active: d.tremolo.active },
    compressor: { amount: a(d.compressor.amount), active: d.compressor.active },
  };
}

const LAYOUT = [
  { key: 'filter', title: 'Filter', hand: 'left', accent: '#37e0cf', knobs: [['cutoff', 'Cutoff']] },
  { key: 'reverb', title: 'Reverb', hand: 'left', accent: '#9b7bff', knobs: [['wet', 'Amount']] },
  { key: 'delay', title: 'Delay', hand: 'left', accent: '#4f9bff', knobs: [['mix', 'Mix'], ['feedback', 'Feedback']] },
  { key: 'tremolo', title: 'Tremolo', hand: 'right', accent: '#ffb14e', knobs: [['rate', 'Rate'], ['depth', 'Depth']] },
  { key: 'compressor', title: 'Compressor', hand: 'right', accent: '#5fd38a', knobs: [['amount', 'Amount']] },
];

const pct = (v) => `${Math.round(v * 100)}%`;

// Human-readable live value per knob, read straight from the raw snapshot.
function formatValue(fxKey, knobKey, s) {
  if (fxKey === 'filter') return `${Math.round(s.filter.cutoff)} Hz`;
  if (fxKey === 'reverb') return s.reverb.active ? pct(s.reverb.wet) : 'off';
  if (fxKey === 'delay') {
    if (!s.delay.active) return 'off';
    return knobKey === 'mix' ? pct(s.delay.mix) : pct(s.delay.feedback);
  }
  if (fxKey === 'tremolo') {
    if (!s.tremolo.active) return 'off';
    return knobKey === 'rate' ? `${s.tremolo.rate.toFixed(1)} Hz` : pct(s.tremolo.depth);
  }
  if (fxKey === 'compressor') return s.compressor.active ? `${s.compressor.ratio.toFixed(1)}:1` : 'off';
  return '';
}

// One arc-ring knob: a dim 270deg track, a bright value arc, a hub, and a pointer.
function knobMarkup(id, label) {
  return `
    <div class="knob" data-k="${id}">
      <svg class="dial" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="track" cx="50" cy="50" r="40" pathLength="100" transform="rotate(135 50 50)"></circle>
        <circle class="arc" cx="50" cy="50" r="40" pathLength="100" transform="rotate(135 50 50)"></circle>
        <circle class="hub" cx="50" cy="50" r="27"></circle>
        <line class="ptr" x1="50" y1="50" x2="50" y2="16"></line>
      </svg>
      <span class="lbl">${label}</span>
      <span class="val">–</span>
    </div>`;
}

export function createControlsPanel(leftEl, rightEl = leftEl) {
  // Per-effect on/off, toggled by clicking the card (or auto-enabled by a grab).
  const enabled = Object.fromEntries(LAYOUT.map((fx) => [fx.key, true]));
  const cards = {};
  const arcs = {};
  const ptrs = {};
  const vals = {};
  const knobEls = {}; // knob id -> the .knob element (for grab-mode hit-testing)

  function setEnabled(key, on) {
    enabled[key] = !!on;
    const card = cards[key];
    if (card) {
      card.classList.toggle('active', enabled[key]);
      card.querySelector('.pwr').textContent = enabled[key] ? 'ON' : 'OFF';
    }
  }

  for (const fx of LAYOUT) {
    const card = document.createElement('div');
    card.className = 'fx active';
    card.style.setProperty('--accent', fx.accent);
    card.title = 'Click to enable / disable';
    const knobs = fx.knobs.map(([k, label]) => knobMarkup(`${fx.key}.${k}`, label)).join('');
    card.innerHTML = `<h3>${fx.title}<span class="pwr">ON</span></h3><div class="knobs">${knobs}</div>`;
    card.addEventListener('click', () => setEnabled(fx.key, !enabled[fx.key]));
    for (const [k] of fx.knobs) {
      const id = `${fx.key}.${k}`;
      const knobEl = card.querySelector(`.knob[data-k="${id}"]`);
      knobEls[id] = knobEl;
      arcs[id] = knobEl.querySelector('.arc');
      ptrs[id] = knobEl.querySelector('.ptr');
      vals[id] = knobEl.querySelector('.val');
    }
    cards[fx.key] = card;
    (fx.hand === 'right' ? rightEl : leftEl).appendChild(card);
  }

  // Knobs reflect the current snapshot each frame (height-driven in Air, grab-driven in Grab).
  function update(snapshot) {
    const d = snapshotToDisplay(snapshot);
    const angles = computeDialAngles(snapshot);
    for (const fx of LAYOUT) {
      for (const [k] of fx.knobs) {
        const id = `${fx.key}.${k}`;
        const v = Math.max(0, Math.min(1, d[fx.key][k]));
        arcs[id].style.strokeDasharray = `${(v * 75).toFixed(2)} 100`;
        ptrs[id].setAttribute('transform', `rotate(${angles[fx.key][k].toFixed(1)} 50 50)`);
        vals[id].textContent = formatValue(fx.key, k, snapshot);
      }
    }
  }

  return { update, getEnabled: () => enabled, setEnabled, getKnobElements: () => knobEls };
}
