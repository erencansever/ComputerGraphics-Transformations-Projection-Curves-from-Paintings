import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/math/mat4.js';
import { near, nearArr, mulVec4, I } from './helpers.js';

const H = Math.PI / 2;

test('identity is column-major I and length 16', () => {
  const m = M.identity();
  assert.equal(m.length, 16);
  nearArr(Array.from(m), I);
});

test('translate stores t in m[12..14] (column-major)', () => {
  const m = M.translate(1, 2, 3);
  nearArr([m[12], m[13], m[14], m[15]], [1, 2, 3, 1]);
  nearArr(mulVec4(m, [0, 0, 0, 1]), [1, 2, 3, 1]);
  nearArr(mulVec4(m, [1, 1, 1, 0]), [1, 1, 1, 0], 'directions ignore translation');
});

test('multiply: identity, associativity of translations, order matters', () => {
  const A = M.rotateZ(0.3);
  nearArr(Array.from(M.multiply(M.identity(), A)), Array.from(A));
  nearArr(Array.from(M.multiply(A, M.identity())), Array.from(A));
  nearArr(Array.from(M.multiply(M.translate(1, 2, 3), M.translate(4, 5, 6))), Array.from(M.translate(5, 7, 9)));
  // T·R applies R first: origin goes to t. R·T rotates t.
  const TR = M.multiply(M.translate(1, 0, 0), M.rotateZ(H));
  const RT = M.multiply(M.rotateZ(H), M.translate(1, 0, 0));
  nearArr(mulVec4(TR, [0, 0, 0, 1]), [1, 0, 0, 1]);
  nearArr(mulVec4(RT, [0, 0, 0, 1]), [0, 1, 0, 1]);
});

test('multiply does not modify its inputs', () => {
  const a = M.translate(1, 2, 3), b = M.scale(2, 2, 2);
  const a0 = Array.from(a), b0 = Array.from(b);
  M.multiply(a, b);
  nearArr(Array.from(a), a0);
  nearArr(Array.from(b), b0);
});

test('rotations are right-handed', () => {
  nearArr(mulVec4(M.rotateZ(H), [1, 0, 0, 0]), [0, 1, 0, 0], 'Rz: x→y');
  nearArr(mulVec4(M.rotateX(H), [0, 1, 0, 0]), [0, 0, 1, 0], 'Rx: y→z');
  nearArr(mulVec4(M.rotateY(H), [0, 0, 1, 0]), [1, 0, 0, 0], 'Ry: z→x');
});

test('scale', () => {
  nearArr(mulVec4(M.scale(2, 3, 4), [1, 1, 1, 1]), [2, 3, 4, 1]);
});

test('transpose', () => {
  const m = M.translate(7, 8, 9);
  const t = M.transpose(m);
  nearArr([t[3], t[7], t[11]], [7, 8, 9]);
  nearArr(Array.from(M.transpose(t)), Array.from(m));
});

test('invertRigid undoes a rigid transform', () => {
  const R = M.multiply(M.rotateX(0.4), M.multiply(M.rotateY(-1.1), M.rotateZ(2.0)));
  const A = M.multiply(M.translate(3, -2, 5), R);
  nearArr(Array.from(M.multiply(A, M.invertRigid(A))), I, 'A·A⁻¹');
  nearArr(Array.from(M.multiply(M.invertRigid(A), A)), I, 'A⁻¹·A');
});

test('transformPoint', () => {
  nearArr(M.transformPoint(M.translate(1, 2, 3), [1, 1, 1]), [2, 3, 4]);
  const p = M.transformPoint(M.multiply(M.translate(0, 0, 0), M.scale(2, 2, 2)), [1, -1, 0.5]);
  nearArr(p, [2, -2, 1]);
});

test('T·R·S vs S·R·T put the object in different places', () => {
  const T = M.translate(2, 0, 0), R = M.rotateY(H), S = M.scale(3, 3, 3);
  const TRS = M.multiply(T, M.multiply(R, S));
  const SRT = M.multiply(S, M.multiply(R, T));
  nearArr(M.transformPoint(TRS, [0, 0, 0]), [2, 0, 0], 'TRS keeps the translation');
  nearArr(M.transformPoint(SRT, [0, 0, 0]), [0, 0, -6], 'SRT rotates and scales the translation');
  near(M.transformPoint(TRS, [1, 0, 0])[2], -3, 'TRS scales the object first');
});
