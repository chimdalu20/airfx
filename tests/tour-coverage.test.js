import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STEPS } from '../src/ui/onboarding.js';

// Tour copy is documentation living inside the app, and it rots exactly like documentation
// while still rendering perfectly. These tests do not check that the prose is CORRECT — that
// is not cheaply testable — they check that nothing interactive is left unexplained, which is
// the failure that is invisible to review. Grab mode once shipped with no tour step at all,
// and nothing anywhere noticed.

// Every interactive surface a first-time user has to understand.
const CONTROLS = [
  '#calibrateBtn', '#recordBtn', '#panicBtn', '#preset',
  '#modeAir', '#modeGrab', '.track-actions', '.fx', '.stage',
];

const targets = STEPS.map((s) => s.target).filter(Boolean);

test('every interactive control is explained by at least one tour step', () => {
  for (const control of CONTROLS) {
    const covered = targets.some((t) => t === control || t.includes(control.replace(/^[#.]/, '')));
    assert.ok(covered, `${control} is never a tour target — it ships unexplained`);
  }
});

test('no step spotlights a container of several unrelated controls', () => {
  // Pointing the spotlight at a row of four buttons promises "look at this" and then
  // breaks the promise. One step, one control.
  assert.ok(!targets.includes('.actions'),
    '.actions holds Calibrate/Record/Mute/Preset — split it into a step each');
});

test('every step has a body worth reading', () => {
  for (const s of STEPS) {
    assert.ok(s.title && s.title.length > 3, `step "${s.title}" needs a title`);
    assert.ok(s.body && s.body.length >= 40, `step "${s.title}" body is too thin to teach anything`);
  }
});

test('exactly one step is marked last', () => {
  assert.equal(STEPS.filter((s) => s.last).length, 1);
  assert.ok(STEPS[STEPS.length - 1].last, 'the last step must be the one marked last');
});

test('tour copy does not describe behaviour that has changed', () => {
  // Each of these was a real stale line at some point this session.
  const prose = STEPS.map((s) => `${s.title} ${s.body} ${s.say || ''}`).join(' ').toLowerCase();
  assert.ok(!/mute is your panic button.*(?!toggle)/.test(prose) || /press it again|toggle/.test(prose),
    'Mute is a toggle — the tour must not present it as one-way');
  assert.ok(!/tap upload and pick any audio file/.test(prose),
    'a demo loop exists; the tour must not imply a file is required');
});

test('phase dots stay countable on a narrow card', () => {
  // The card is min(360px, 100vw - 24px); dots are 16px + 4px gap and must not wrap.
  const phases = [...new Set(STEPS.map((s) => s.phase))];
  const width = phases.length * 16 + (phases.length - 1) * 4;
  assert.ok(width <= 351, `${phases.length} phases need ${width}px of dots; the card is ~351px at 375px`);
});

test('the guide metadata removed with the floating hand is really gone', () => {
  const src = readFileSync(new URL('../src/ui/onboarding.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('ob-hand'), 'the floating hand emoji element was removed');
  assert.ok(!src.includes('showHand'), 'its positioning function was removed');
  assert.ok(!/guide: \{/.test(src), 'its per-step metadata was removed');
});
