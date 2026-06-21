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
  { key: 'filter', title: 'Filter', hand: 'left', knobs: [['cutoff', 'Cutoff']] },
  { key: 'reverb', title: 'Reverb', hand: 'left', knobs: [['wet', 'Amount']] },
  { key: 'delay', title: 'Delay', hand: 'left', knobs: [['mix', 'Mix'], ['feedback', 'Feedback']] },
  { key: 'tremolo', title: 'Tremolo', hand: 'right', knobs: [['rate', 'Rate'], ['depth', 'Depth']] },
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

// leftEl holds the left-hand effects (filter/reverb/delay), rightEl the right-hand
// effect (tremolo). If rightEl is omitted, everything renders into leftEl.
export function createControlsPanel(leftEl, rightEl = leftEl) {
  const dials = {};
  const vals = {};
  const groups = {};
  for (const fx of LAYOUT) {
    const card = document.createElement('div');
    card.className = 'fx';
    card.innerHTML = `<h3>${fx.title}</h3><div class="knobs"></div>`;
    const knobsEl = card.querySelector('.knobs');
    for (const [knobKey, label] of fx.knobs) {
      const k = document.createElement('div');
      k.className = 'knob';
      k.innerHTML = `<div class="dial"></div><span class="lbl">${label}</span><span class="val">–</span>`;
      knobsEl.appendChild(k);
      dials[`${fx.key}.${knobKey}`] = k.querySelector('.dial');
      vals[`${fx.key}.${knobKey}`] = k.querySelector('.val');
    }
    (fx.hand === 'right' ? rightEl : leftEl).appendChild(card);
    groups[fx.key] = card;
  }

  function update(snapshot) {
    const angles = computeDialAngles(snapshot);
    for (const fx of LAYOUT) {
      groups[fx.key].classList.toggle('active', !!angles[fx.key].active);
      for (const [knobKey] of fx.knobs) {
        const dial = dials[`${fx.key}.${knobKey}`];
        dial.style.setProperty('--angle', `${angles[fx.key][knobKey]}deg`);
        dial.dataset.angle = angles[fx.key][knobKey].toFixed(1);
        vals[`${fx.key}.${knobKey}`].textContent = formatValue(fx.key, knobKey, snapshot);
      }
    }
  }

  return { update };
}
