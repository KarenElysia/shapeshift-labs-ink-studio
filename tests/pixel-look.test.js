const test = require('node:test');
const assert = require('node:assert/strict');
const look = require('../src/pixel-look.js');

test('contours retain green, violet and warm bone hues without black ink', () => {
  for (const body of [[0.18, 0.65, 0.12], [0.62, 0.19, 0.78], [0.9, 0.78, 0.51]]) {
    const ink = look.ink(body);
    assert(ink.every(v => v > 0));
    const luma = ink[0] * 0.30 + ink[1] * 0.55 + ink[2] * 0.15;
    assert(luma >= 0.119);
    assert(Math.abs(ink[0] / ink[1] - body[0] / body[1]) < 1e-6);
  }
});

test('a solid silhouette gets its own contour while empty space stays black', () => {
  const w = 8, h = 8, depth = new Float32Array(w * h).fill(1), color = new Uint8Array(w * h * 3);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
    const p = y * w + x; depth[p] = 0.4; color.set([51, 153, 34], p * 3);
  }
  const image = look.resolve({ w, h, depth, color, palette: [[0, 0, 0], [0.2, 0.6, 0.133]] });
  assert.deepEqual([image.w, image.h], [4, 4]);
  assert.equal(image.use.reduce((sum, n) => sum + n, 0), 16);
  assert.deepEqual(Array.from(image.rgb.slice(0, 3)), [0, 0, 0]);
  const body = Array.from(image.rgb.slice((1 * 4 + 1) * 3, (1 * 4 + 1) * 3 + 3));
  assert(body[1] > body[0] && body[1] > body[2]);
  assert(body.every(v => v > 0));
});

test('colored contours follow the active palette grade', () => {
  const depth = new Float32Array(16).fill(0.4), color = new Uint8Array(48);
  for (let i = 0; i < 16; i++) color.set([51, 153, 34], i * 3);
  const image = look.resolve({ w: 4, h: 4, depth, color, palette: [[0, 0, 0], [0.2, 0.6, 0.133]], grade: [0, 0, 0, 0.65, 0.2, 0.8] });
  assert(image.rgb[2] > image.rgb[0] && image.rgb[0] > image.rgb[1]);
});

test('interior material edges remain exact palette colors, even across a depth step', () => {
  const w = 8, h = 8, depth = new Float32Array(w * h), color = new Uint8Array(w * h * 3);
  const palette = [[0, 0, 0], [51 / 255, 153 / 255, 34 / 255], [230 / 255, 213 / 255, 162 / 255]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; depth[i] = x < 4 ? 0.3 : 0.6;
    color.set(x < 4 ? [230, 213, 162] : [51, 153, 34], i * 3);
  }
  const image = look.resolve({ w, h, depth, color, palette });
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const q = (y * 4 + x) * 3;
    assert.deepEqual(Array.from(image.rgb.slice(q, q + 3)), x < 2 ? [230, 213, 162] : [51, 153, 34]);
  }
});

test('native-grid interior details survive even when supersamples prefer another color', () => {
  const color = new Uint8Array(8 * 8 * 3), depth = new Float32Array(64).fill(0.4), interiorColor = new Uint8Array(4 * 4 * 3);
  for (let i = 0; i < 64; i++) color.set([51, 153, 34], i * 3);
  for (let i = 0; i < 16; i++) interiorColor.set(i % 2 ? [230, 213, 162] : [51, 153, 34], i * 3);
  const palette = [[0, 0, 0], [51 / 255, 153 / 255, 34 / 255], [230 / 255, 213 / 255, 162 / 255]];
  const image = look.resolve({ w: 8, h: 8, color, depth, palette, interiorColor });
  for (let i = 0; i < 16; i++) assert.deepEqual(Array.from(image.rgb.slice(i * 3, i * 3 + 3)), i % 2 ? [230, 213, 162] : [51, 153, 34]);
  assert.equal(image.use[1], 8); assert.equal(image.use[2], 8);
});
