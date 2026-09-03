import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineStatus } from '../src/engine-status.js';

test('starts loading, with the engine named', () => {
  const e = createEngineStatus('MediaPipe hand tracking');
  assert.equal(e.name, 'MediaPipe hand tracking');
  assert.equal(e.getState(), 'loading');
  assert.equal(e.isLoading(), true);
  assert.equal(e.isReady(), false);
});

test('ready() flips state and notifies listeners once', () => {
  const e = createEngineStatus('x');
  const seen = [];
  e.onChange((state) => seen.push(state));
  e.ready();
  e.ready(); // idempotent: a second call must not re-notify
  assert.equal(e.isReady(), true);
  assert.deepEqual(seen, ['ready']);
});

test('fail() records the error and reports it', () => {
  const e = createEngineStatus('x');
  const boom = new Error('cdn unreachable');
  const seen = [];
  e.onChange((state, err) => seen.push([state, err?.message]));
  e.fail(boom);
  assert.equal(e.getState(), 'error');
  assert.equal(e.isReady(), false);
  assert.equal(e.isLoading(), false);
  assert.equal(e.getError(), boom);
  assert.deepEqual(seen, [['error', 'cdn unreachable']]);
});

test('unsubscribing stops delivery', () => {
  // A torn-down tour must not keep a listener that writes into removed DOM.
  const e = createEngineStatus('x');
  let calls = 0;
  const off = e.onChange(() => { calls++; });
  off();
  e.ready();
  assert.equal(calls, 0);
});

test('a listener that unsubscribes during notification does not break the others', () => {
  const e = createEngineStatus('x');
  const order = [];
  const off = e.onChange(() => { order.push('a'); off(); });
  e.onChange(() => order.push('b'));
  e.ready();
  assert.deepEqual(order, ['a', 'b']);
});

test('fail() after ready() is still recorded', () => {
  const e = createEngineStatus('x');
  e.ready();
  e.fail(new Error('camera unplugged'));
  assert.equal(e.getState(), 'error');
});
