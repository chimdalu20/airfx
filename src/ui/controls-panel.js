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
  };
}

const LAYOUT = [
  { key: 'filter', title: 'Filter', hand: 'left', accent: '#37e0cf', knobs: [['cutoff', 'Cutoff']] },
  { key: 'reverb', title: 'Reverb', hand: 'left', accent: '#9b7bff', knobs: [['wet', 'Amount']] },
  { key: 'delay', title: 'Delay', hand: 'left', accent: '#4f9bff', knobs: [['mix', 'Mix'], ['feedback', 'Feedback']] },
  { key: 'tremolo', title: 'Tremolo', hand: 'right', accent: '#ffb14e', knobs: [['rate', 'Rate'], ['depth', 'Depth']] },
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
  const arcs = {};
  const ptrs = {};
  const vals = {};
  const groups = {};
  for (const fx of LAYOUT) {
    const card = document.createElement('div');
    card.className = 'fx';
    card.style.setProperty('--accent', fx.accent);
    const knobs = fx.knobs.map(([k, label]) => knobMarkup(`${fx.key}.${k}`, label)).join('');
    card.innerHTML = `<h3>${fx.title}</h3><div class="knobs">${knobs}</div>`;
    for (const [k] of fx.knobs) {
      const id = `${fx.key}.${k}`;
      const knobEl = card.querySelector(`.knob[data-k="${id}"]`);
      arcs[id] = knobEl.querySelector('.arc');
      ptrs[id] = knobEl.querySelector('.ptr');
      vals[id] = knobEl.querySelector('.val');
    }
    (fx.hand === 'right' ? rightEl : leftEl).appendChild(card);
    groups[fx.key] = card;
  }

  function update(snapshot) {
    const d = snapshotToDisplay(snapshot);
    const angles = computeDialAngles(snapshot);
    for (const fx of LAYOUT) {
      groups[fx.key].classList.toggle('active', !!angles[fx.key].active);
      for (const [k] of fx.knobs) {
        const id = `${fx.key}.${k}`;
        const v = Math.max(0, Math.min(1, d[fx.key][k]));
        // value arc: 0..75 of pathLength = 0..270deg
        arcs[id].style.strokeDasharray = `${(v * 75).toFixed(2)} 100`;
        ptrs[id].setAttribute('transform', `rotate(${angles[fx.key][k].toFixed(1)} 50 50)`);
        vals[id].textContent = formatValue(fx.key, k, snapshot);
      }
    }
  }

  return { update };
}
