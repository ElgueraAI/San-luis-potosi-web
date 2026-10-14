/**
 * Chart geometry of the tourism intelligence chapters. Run: npm run test:intel
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { treemap, ticks, linear, linePath, symbolRadius, ramp, RAMP_INVERT } from '../../src/lib/charts/geometry';

const box = { x: 0, y: 0, w: 1000, h: 520 };

test('treemap: areas are proportional and fill the box without overlap', () => {
  const items = [153, 80, 64, 61, 41, 34, 33, 25, 22, 13, 11, 9].map((value, i) => ({ value, data: i }));
  const cells = treemap(items, box);
  const total = items.reduce((s, i) => s + i.value, 0);
  assert.equal(cells.length, items.length);
  for (const c of cells) {
    assert.ok(Math.abs((c.w * c.h) / (box.w * box.h) - c.value / total) < 1e-9, 'area follows the value');
    assert.ok(c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.w <= box.w + 1e-6 && c.y + c.h <= box.h + 1e-6, 'inside the box');
  }
  assert.ok(Math.abs(cells.reduce((s, c) => s + c.w * c.h, 0) - box.w * box.h) < 1e-6);
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
    const a = cells[i], b = cells[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    assert.ok(!(ox > 1e-6 && oy > 1e-6), 'no two cells overlap');
  }
});

test('treemap: nothing is drawn for nothing, and zero values are dropped', () => {
  assert.deepEqual(treemap([], box), []);
  assert.deepEqual(treemap([{ value: 0, data: 'a' }], box), []);
  assert.equal(treemap([{ value: 0, data: 'a' }, { value: 5, data: 'b' }, { value: -2, data: 'c' }], box).length, 1);
  assert.deepEqual(treemap([{ value: 5, data: 'b' }], { ...box, w: 0 }), []);
});

test('treemap: a nested layout stays inside its parent', () => {
  const [parent] = treemap([{ value: 10, data: 'p' }, { value: 30, data: 'q' }], box).filter((c) => c.data === 'p');
  for (const c of treemap([{ value: 3, data: 1 }, { value: 7, data: 2 }], parent)) {
    assert.ok(c.x >= parent.x - 1e-9 && c.x + c.w <= parent.x + parent.w + 1e-6 && c.y >= parent.y - 1e-9 && c.y + c.h <= parent.y + parent.h + 1e-6);
  }
});

test('ticks: round steps that cover the maximum', () => {
  assert.deepEqual(ticks(1, 4), [0, 0.5, 1]);
  assert.deepEqual(ticks(36, 4), [0, 10, 20, 30]);
  assert.deepEqual(ticks(0), [0]);
});

test('scales: linear, symbol area and line path', () => {
  const x = linear(0, 1, 50, 650);
  assert.equal(x(0), 50); assert.equal(x(1), 650); assert.equal(x(0.5), 350);
  assert.equal(linear(2, 2, 0, 10)(5), 0, 'a flat domain does not divide by zero');
  assert.equal(symbolRadius(0, 33, 26, 5), 0, 'no value, no symbol');
  assert.equal(symbolRadius(33, 33, 26, 5), 26);
  assert.ok(Math.abs(symbolRadius(33 / 4, 33, 26) - 13) < 1e-9, 'a quarter of the value is half the radius: area follows the value');
  assert.equal(symbolRadius(0.01, 33, 26, 5), 5, 'small values stay visible');
  assert.equal(linePath([[0, 0], [10, 5.25]]), 'M0.0 0.0 L10.0 5.3');
});

test('ramp: five classes, zero stays zero, the top class inverts its text', () => {
  assert.equal(ramp(0, 10), 0);
  assert.equal(ramp(5, 0), 0);
  assert.equal(ramp(10, 10), 1);
  const classes = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => ramp(v, 10)));
  assert.equal(classes.size, 5);
  assert.ok(ramp(1, 10) < RAMP_INVERT && ramp(8, 10) >= RAMP_INVERT);
  let prev = 0;
  for (let v = 1; v <= 10; v++) { assert.ok(ramp(v, 10) >= prev, 'monotonic'); prev = ramp(v, 10); }
});
