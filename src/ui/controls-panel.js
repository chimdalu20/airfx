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
  { key: 'filter', title: 'Filter', hand: 'left', knobs: [['cutoff', 'Cutoff']] },
  { key: 'reverb', title: 'Reverb', hand: 'left', knobs: [['wet', 'Amount']] },
  { key: 'delay', title: 'Delay', hand: 'left', knobs: [['mix', 'Mix'], ['feedback', 'Feedback']] },
  { key: 'tremolo', title: 'Tremolo', hand: 'right', knobs: [['rate', 'Rate'], ['depth', 'Depth']] },
  { key: 'compressor', title: 'Compressor', hand: 'right', knobs: [['amount', 'Amount']] },
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
  // Everything starts armed, so a first gesture audibly does something without hunting for
  // a switch. The tour teaches switching them OFF, which is the useful direction: you drop
  // effects out of a mix far more often than you go looking for one that is silent.
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
      card.setAttribute('aria-pressed', String(enabled[key]));
      card.querySelector('.pwr').textContent = enabled[key] ? 'ON' : 'OFF';
    }
  }

  for (const fx of LAYOUT) {
    const card = document.createElement('div');
    card.className = enabled[fx.key] ? 'fx active' : 'fx';
    // Keyboard- and screen-reader-operable: it was a bare div with a click handler.
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', String(enabled[fx.key]));
    card.setAttribute('aria-label', `${fx.title} effect`);
    card.title = `Turn ${fx.title} on or off`;
    const knobs = fx.knobs.map(([k, label]) => knobMarkup(`${fx.key}.${k}`, label)).join('');
    card.innerHTML = `<h3>${fx.title}<span class="pwr">${enabled[fx.key] ? 'ON' : 'OFF'}</span></h3><div class="knobs">${knobs}</div>`;
    card.addEventListener('click', () => setEnabled(fx.key, !enabled[fx.key]));
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault(); // Space would scroll the page
      setEnabled(fx.key, !enabled[fx.key]);
    });
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
