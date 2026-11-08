/**
 * Part C — view and projection matrices.             ★ STUDENT CODE ★
 *
 * Camera convention: the camera sits at the origin of view space looking down
 * −z, with +y up and +x to the right (right-handed, like OpenGL).
 *
 * Clip space is WebGPU's, NOT OpenGL's:  x, y ∈ [−1, 1] and z ∈ [0, 1]
 * after the perspective divide. A point on the near plane must land on z = 0,
 * a point on the far plane on z = 1. The renderer clears depth to 1.0 and
 * uses depthCompare 'less'.
 *
 * Run `npm test` — tests/camera.test.js must pass.
 */
import { todo } from './todo.js';

/**
 * View matrix from eye, target and up, built with two cross products.
 * Must not produce NaN when `up` is parallel to (target − eye): pick another
 * helper axis in that case.
 * @param {number[]} eye    [x, y, z]
 * @param {number[]} target [x, y, z]
 * @param {number[]} up     [x, y, z]
 * @returns {Float32Array}
 */
export function lookAt(eye, target, up) {
  return todo('camera.lookAt');
}

/**
 * Perspective projection; depth mapped to [0, 1].
 * @param {number} fovY   vertical field of view in radians
 * @param {number} aspect width / height
 * @param {number} near   > 0
 * @param {number} far    > near
 * @returns {Float32Array}
 */
export function perspective(fovY, aspect, near, far) {
  return todo('camera.perspective');
}

/**
 * Orthographic projection of the view-space box
 * [left, right] × [bottom, top] × [−near, −far]; depth mapped to [0, 1].
 * @returns {Float32Array}
 */
export function orthographic(left, right, bottom, top, near, far) {
  return todo('camera.orthographic');
}
