import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampRect, moveRect, placeNewRect, resizeRect, round4 } from '../src/core/geometry.js';

const start = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 };

test('round4 keeps four decimals', () => {
  assert.equal(round4(0.123456), 0.1235);
  assert.equal(round4(0.1 + 0.2), 0.3);
});

test('moveRect moves and keeps size', () => {
  assert.deepEqual(moveRect(start, 0.1, -0.05), { x: 0.3, y: 0.15, w: 0.3, h: 0.3 });
});

test('moveRect cannot leave the canvas', () => {
  assert.deepEqual(moveRect(start, -1, -1), { x: 0, y: 0, w: 0.3, h: 0.3 });
  assert.deepEqual(moveRect(start, 5, 5), { x: 0.7, y: 0.7, w: 0.3, h: 0.3 });
});

test('resizeRect respects minimum size and canvas edge', () => {
  const min = { w: 0.1, h: 0.15 };
  assert.deepEqual(resizeRect(start, 0.1, 0.1, min), { x: 0.2, y: 0.2, w: 0.4, h: 0.4 });
  assert.deepEqual(resizeRect(start, -1, -1, min), { x: 0.2, y: 0.2, w: 0.1, h: 0.15 });
  assert.deepEqual(resizeRect(start, 5, 5, min), { x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
});

test('clampRect fixes oversized and out-of-bounds rects', () => {
  assert.deepEqual(clampRect({ x: 0.9, y: -0.2, w: 1.4, h: 0.5 }), { x: 0, y: 0, w: 1, h: 0.5 });
  assert.deepEqual(clampRect({ x: 0.5, y: 0.5, w: 0.01, h: 0.01 }, { w: 0.1, h: 0.1 }), {
    x: 0.5,
    y: 0.5,
    w: 0.1,
    h: 0.1,
  });
});

test('placeNewRect cascades and stays inside the canvas', () => {
  const size = { w: 0.3, h: 0.36 };
  const first = placeNewRect(size, 0);
  const second = placeNewRect(size, 1);
  assert.ok(second.x > first.x && second.y > first.y);
  assert.deepEqual(placeNewRect(size, 6), first, 'cycle repeats every 6');
  for (let i = 0; i < 12; i += 1) {
    const r = placeNewRect({ w: 0.9, h: 0.9 }, i);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1);
  }
});
