/**
 * BONUS — quaternions for the orbit camera.          ★ STUDENT CODE ★
 * A quaternion is [x, y, z, w] (w is the scalar part). Unit quaternions only.
 * Enable "quaternion orbit" in the UI once these work; tests/quat.test.js.
 */
import { todo } from './todo.js';

/** Rotation of `rad` about the (unit) axis. */
export function fromAxisAngle(axis, rad) {
  return todo('quat.fromAxisAngle');
}

/** Hamilton product a ⊗ b (apply b first, then a). */
export function multiply(a, b) {
  return todo('quat.multiply');
}

/** Returns q / |q|. */
export function normalize(q) {
  return todo('quat.normalize');
}

/** Spherical linear interpolation along the shorter arc. */
export function slerp(a, b, t) {
  return todo('quat.slerp');
}

/** Rotates the vector v = [x, y, z] by q. */
export function rotateVec3(q, v) {
  return todo('quat.rotateVec3');
}
