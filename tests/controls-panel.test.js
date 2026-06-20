import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDialAngles } from '../src/ui/controls-panel.js';

test('computeDialAngles maps a full snapshot to centered angles', () => {
  const angles = computeDialAngles({
    filter: { cutoff: 12000, q: 1 },
    reverb: { wet: 0.9, active: true },
    delay: { mix: 0.5, time: 0.28, feedback: 0.55, active: true },
    tremolo: { rate: 12, depth: 1, active: true },
  });
  assert.ok(Math.abs(angles.filter.cutoff - 135) < 1e-6);   // max -> +135
  assert.ok(Math.abs(angles.reverb.wet - 135) < 1e-6);
  assert.ok(Math.abs(angles.tremolo.depth - 135) < 1e-6);
  assert.equal(angles.delay.active, true);
});
