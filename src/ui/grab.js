import { clamp } from '../math.js';

// Grab mode: two on-screen cursors follow each hand's index fingertip; a pinch
// (thumb + index) over a knob grabs it; then moving the hand up/down OR left/right
// turns it. Holds a 0..1 value per knob (the audio snapshot is built from these).

const SENS = 2.0; // full-range travel ~= half the window in one axis (axes add)
const PINCH_ON = 0.5; // pinch when tip distance / hand size < this
const PINCH_OFF = 0.7; // release threshold (hysteresis so a held pinch doesn't flicker)

export function createGrab({ rack }) {
  const knobEls = rack.getKnobElements();
  const values = {};
  Object.keys(knobEls).forEach((id) => { values[id] = 0.5; });

  const layer = document.createElement('div');
  layer.className = 'grab-layer';
  layer.hidden = true;
  const cursors = { left: makeCursor('left', 'L'), right: makeCursor('right', 'R') };
  layer.append(cursors.left, cursors.right);
  document.body.appendChild(layer);

  const grab = { left: null, right: null };
  const pinched = { left: false, right: false };
  const smooth = { left: null, right: null };

  function makeCursor(side, label) {
    const el = document.createElement('div');
    el.className = `grab-cursor ${side}`;
    el.innerHTML = `<span class="gc-ring"></span><span class="gc-label">${label}</span>`;
    el.hidden = true;
    return el;
  }

  function probe(lm) {
    if (!lm) return null;
    const x = (1 - lm[8].x) * window.innerWidth; // mirror x to match the flipped video
    const y = lm[8].y * window.innerHeight;
    const size = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-4;
    const dist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / size;
    return { x, y, dist };
  }

  function knobAt(x, y) {
    for (const id in knobEls) {
      const r = knobEls[id].getBoundingClientRect();
      const pad = 16;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return id;
    }
    return null;
  }

  function handleSide(side, lm) {
    const cur = cursors[side];
    const p = probe(lm);
    if (!p) { cur.hidden = true; grab[side] = null; pinched[side] = false; smooth[side] = null; return; }
    const s = smooth[side];
    const x = s ? s.x + (p.x - s.x) * 0.5 : p.x;
    const y = s ? s.y + (p.y - s.y) * 0.5 : p.y;
    smooth[side] = { x, y };

    cur.hidden = false;
    cur.style.left = `${x}px`;
    cur.style.top = `${y}px`;
    pinched[side] = pinched[side] ? p.dist < PINCH_OFF : p.dist < PINCH_ON;
    cur.classList.toggle('pinch', pinched[side]);

    if (pinched[side]) {
      if (!grab[side]) {
        const id = knobAt(x, y);
        if (id) {
          grab[side] = { id, sx: x, sy: y, sv: values[id] };
          rack.setEnabled(id.split('.')[0], true); // grabbing a knob turns its effect on
          cur.classList.add('hold');
        }
      } else {
        const g = grab[side];
        const dx = (x - g.sx) / window.innerWidth;
        const dy = (g.sy - y) / window.innerHeight; // up is positive
        values[g.id] = clamp(g.sv + (dx + dy) * SENS, 0, 1);
      }
    } else {
      grab[side] = null;
      cur.classList.remove('hold');
    }
  }

  function update(frame) {
    handleSide('left', frame.left && frame.left.lm);
    handleSide('right', frame.right && frame.right.lm);
  }

  function setActive(on) {
    layer.hidden = !on;
    if (!on) {
      grab.left = grab.right = null;
      pinched.left = pinched.right = false;
      cursors.left.hidden = true;
      cursors.right.hidden = true;
    }
  }

  return { update, setActive, getValues: () => values };
}
