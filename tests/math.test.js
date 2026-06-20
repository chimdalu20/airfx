import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, normalize, logMap, linMap } from '../src/math.js';

test('clamp bounds the value', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('lerp interpolates', () => {
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('normalize maps and clamps to 0..1', () => {
  assert.equal(normalize(5, 0, 10), 0.5);
  assert.equal(normalize(-5, 0, 10), 0);
  assert.equal(normalize(50, 0, 10), 1);
  assert.equal(normalize(3, 5, 5), 0); // degenerate range
});

test('logMap is geometric across the range', () => {
  assert.equal(logMap(0, 80, 12000), 80);
  assert.equal(logMap(1, 80, 12000), 12000);
  assert.ok(Math.abs(logMap(0.5, 80, 12000) - Math.sqrt(80 * 12000)) < 1e-6);
});

test('linMap clamps t then interpolates', () => {
  assert.equal(linMap(0.5, 0, 10), 5);
  assert.equal(linMap(2, 0, 10), 10);
});
