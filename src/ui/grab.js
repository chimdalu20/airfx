import { clamp } from '../math.js';

// Grab mode: two on-screen cursors follow each hand's index fingertip; a pinch
// (thumb + index) over a knob grabs it; then moving the hand up/down OR left/right
// turns it. Holds a 0..1 value per knob (the audio snapshot is built from these).

const SENS = 2.0; // turn speed: ~half a frame of raw hand travel = full range (axes add)
const PINCH_ON = 0.32; // grab when thumb-index tip distance / hand size < this (a real pinch)
const PINCH_OFF = 0.48; // release threshold (hysteresis so a held pinch doesn't flicker)
// Map only the central region of the camera frame to the whole screen, so the cursor
// reaches the edges while the hand stays well inside the frame (where tracking is solid).
const MARGIN_X = 0.25;
const MARGIN_Y = 0.18;

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

  // Raw mirrored fingertip position (0..1) + the pinch ratio. Reach amplification and
  // pixel mapping happen later so the turn delta stays based on real hand travel.
  function probe(lm) {
    if (!lm) return null;
    const size = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y) || 1e-4;
    return {
      mrx: 1 - lm[8].x, // mirror x to match the flipped video
      mry: lm[8].y,
      dist: Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) / size,
    };
  }

  const amp = (v, m) => clamp((v - m) / (1 - 2 * m), 0, 1);

  function knobAt(x, y) {
    for (const id in knobEls) {
      const r = knobEls[id].getBoundingClientRect();
      const pad = 18;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return id;
    }
    return null;
  }

  function handleSide(side, lm) {
    const cur = cursors[side];
    const p = probe(lm);
    if (!p) { cur.hidden = true; grab[side] = null; pinched[side] = false; smooth[side] = null; return; }

    // smooth the raw mirrored coords (used for both the cursor and the turn delta)
    const s = smooth[side];
    const mrx = s ? s.x + (p.mrx - s.x) * 0.5 : p.mrx;
    const mry = s ? s.y + (p.mry - s.y) * 0.5 : p.mry;
    smooth[side] = { x: mrx, y: mry };

    // amplified screen position so the cursor reaches the edges within the trackable range
    const cx = amp(mrx, MARGIN_X) * window.innerWidth;
    const cy = amp(mry, MARGIN_Y) * window.innerHeight;
    cur.hidden = false;
    cur.style.left = `${cx}px`;
    cur.style.top = `${cy}px`;

    pinched[side] = pinched[side] ? p.dist < PINCH_OFF : p.dist < PINCH_ON;
    cur.classList.toggle('pinch', pinched[side]);

    if (pinched[side]) {
      if (!grab[side]) {
        const id = knobAt(cx, cy);
        if (id) {
          grab[side] = { id, rx: mrx, ry: mry, sv: values[id] };
          rack.setEnabled(id.split('.')[0], true); // grabbing a knob turns its effect on
          cur.classList.add('hold');
        }
      } else {
        const g = grab[side];
        const dx = mrx - g.rx; // raw travel -> precise turning, independent of reach amplification
        const dy = g.ry - mry; // up is positive
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
