/**
 * Part A — 4×4 matrix library.                       ★ STUDENT CODE ★
 *
 * The handout (section 4) requires you to write this file yourself; AI tools
 * may explain or debug it, not generate it.
 *
 * Conventions used by the whole application:
 *   • A matrix is a Float32Array(16) in COLUMN-MAJOR order:
 *       element (row r, column c)  ==  m[c * 4 + r]
 *     so the translation of an affine matrix lives in m[12], m[13], m[14].
 *     This is exactly the layout WGSL's mat4x4f expects in a uniform buffer.
 *   • Column vectors:  p' = M · p.   multiply(A, B) means A·B (B is applied first).
 *   • Right-handed world, y up. Angles in radians.
 *   • Model matrices are composed as M = T · R · S unless the UI switch says S·R·T.
 *
 * Run `npm test` — tests/mat4.test.js must pass.
 */
import { todo } from './todo.js';

/** @returns {Float32Array} the 4×4 identity. */
export function identity() {
  return todo('mat4.identity');
}

/** @returns {Float32Array} the product a · b (a and b are not modified). */
export function multiply(a, b) {
  return todo('mat4.multiply');
}

/** @returns {Float32Array} translation by (tx, ty, tz). */
export function translate(tx, ty, tz) {
  return todo('mat4.translate');
}

/** @returns {Float32Array} right-handed rotation of `rad` about +x (y → z). */
export function rotateX(rad) {
  return todo('mat4.rotateX');
}

/** @returns {Float32Array} right-handed rotation of `rad` about +y (z → x). */
export function rotateY(rad) {
  return todo('mat4.rotateY');
}

/** @returns {Float32Array} right-handed rotation of `rad` about +z (x → y). */
export function rotateZ(rad) {
  return todo('mat4.rotateZ');
}

/** @returns {Float32Array} non-uniform scale. */
export function scale(sx, sy, sz) {
  return todo('mat4.scale');
}

/** @returns {Float32Array} the transpose of m. */
export function transpose(m) {
  return todo('mat4.transpose');
}

/**
 * Inverse of a RIGID transform (rotation + translation only, no scale).
 * Do not write a general 4×4 inverse: use the structure of [R | t].
 * @returns {Float32Array}
 */
export function invertRigid(m) {
  return todo('mat4.invertRigid');
}

/**
 * Applies m to the point p = [x, y, z] (w = 1) and returns [x', y', z'],
 * divided by w' when w' ≠ 1.
 */
export function transformPoint(m, p) {
  return todo('mat4.transformPoint');
}
