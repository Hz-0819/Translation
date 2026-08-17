import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePoint, denormalizePoint, parseStoredStrokes } from '../src/ink.js';

test('normalizes coordinates inside a page', () => {
  const point = normalizePoint(150, 250, { left: 50, top: 50, width: 400, height: 800 });
  assert.deepEqual(point, { x: 0.25, y: 0.25 });
});

test('clamps coordinates outside the page', () => {
  assert.deepEqual(normalizePoint(-10, 999, { left: 0, top: 0, width: 100, height: 100 }), { x: 0, y: 1 });
});

test('denormalizes on a different viewport size', () => {
  assert.deepEqual(denormalizePoint({ x: 0.25, y: 0.5 }, 800, 1200), { x: 200, y: 600 });
});

test('ignores corrupt or non-array stored ink data', () => {
  assert.deepEqual(parseStoredStrokes('{broken'), []);
  assert.deepEqual(parseStoredStrokes('{"points":[]}'), []);
  assert.deepEqual(parseStoredStrokes('[{"points":[]}]'), [{ points: [] }]);
});
