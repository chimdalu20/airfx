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
  { key: 'filter', title: 'Filter', knobs: [['cutoff', 'Cutoff']] },
  { key: 'reverb', title: 'Reverb', knobs: [['wet', 'Amount']] },
  { key: 'delay', title: 'Delay', knobs: [['mix', 'Mix'], ['feedback', 'Feedback']] },
  { key: 'tremolo', title: 'Tremolo', knobs: [['rate', 'Rate'], ['depth', 'Depth']] },
];

export function createControlsPanel(rootEl) {
  const dials = {};
  const groups = {};
  for (const fx of LAYOUT) {
    const card = document.createElement('div');
    card.className = 'fx';
    card.innerHTML = `<h3>${fx.title}</h3><div class="knobs"></div>`;
    const knobsEl = card.querySelector('.knobs');
    for (const [knobKey, label] of fx.knobs) {
      const k = document.createElement('div');
      k.className = 'knob';
      k.innerHTML = `<div class="dial"></div><span>${label}</span>`;
      knobsEl.appendChild(k);
      dials[`${fx.key}.${knobKey}`] = k.querySelector('.dial');
    }
    rootEl.appendChild(card);
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
      }
    }
  }

  return { update };
}
