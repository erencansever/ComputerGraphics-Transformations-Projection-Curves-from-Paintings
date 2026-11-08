import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookAt, perspective, orthographic } from '../src/math/camera.js';
import { near, nearArr, project } from './helpers.js';

const len = (v) => Math.hypot(...v);

test('lookAt: eye → origin, target → −z axis', () => {
  const eye = [3, 2, 5], target = [0, 1, 0];
  const V = lookAt(eye, target, [0, 1, 0]);
  nearArr(project(V, eye), [0, 0, 0], 'eye');
  const d = len([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  nearArr(project(V, target), [0, 0, -d], 'target');
});

test('lookAt: rotation part is orthonormal and keeps up above', () => {
  const V = lookAt([1, 2, 6], [0, 0, 0], [0, 1, 0]);
  for (let r = 0; r < 3; r++) {
    near(len([V[r], V[4 + r], V[8 + r]]), 1, `row ${r} length`);
  }
  near(V[0] * V[1] + V[4] * V[5] + V[8] * V[9], 0, 'rows 0·1');
  assert.ok(project(V, [0, 10, 0])[1] > 0, 'world up stays up on screen');
});

test('lookAt: up parallel to the view direction gives no NaN', () => {
  for (const [eye, up] of [[[0, 5, 0], [0, 1, 0]], [[0, -5, 0], [0, 1, 0]], [[0, 0, 4], [0, 0, 1]]]) {
    const V = lookAt(eye, [0, 0, 0], up);
    assert.ok(Array.from(V).every(Number.isFinite), `finite for eye ${eye}`);
    nearArr(project(V, [0, 0, 0]), [0, 0, -len(eye)], 'target still on −z');
    for (let r = 0; r < 3; r++) near(len([V[r], V[4 + r], V[8 + r]]), 1, 'orthonormal');
  }
});

test('perspective: WebGPU depth range [0, 1]', () => {
  const n = 0.5, f = 40, fov = Math.PI / 3, a = 1.5;
  const P = perspective(fov, a, n, f);
  near(project(P, [0, 0, -n])[2], 0, 'near plane → z = 0');
  near(project(P, [0, 0, -f])[2], 1, 'far plane → z = 1');
  const zMid = project(P, [0, 0, -(n + f) / 2])[2];
  assert.ok(zMid > 0.5 && zMid < 1, 'depth is non-linear, crowded towards 1');
  const h = Math.tan(fov / 2) * 10;
  nearArr(project(P, [h * a, h, -10]).slice(0, 2), [1, 1], 'frustum edge → ±1');
});

test('orthographic: box → [−1,1]² × [0,1]', () => {
  const O = orthographic(-4, 2, -1, 3, 1, 21);
  nearArr(project(O, [-4, -1, -1]), [-1, -1, 0]);
  nearArr(project(O, [2, 3, -21]), [1, 1, 1]);
  near(project(O, [0, 0, -11])[2], 0.5, 'linear depth');
});
