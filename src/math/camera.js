/**
 * Part C — view and projection matrices.
 *
 * Camera convention: the camera sits at the origin of view space looking down
 * −z, with +y up and +x to the right (right-handed, like OpenGL).
 *
 * Clip space is WebGPU's, NOT OpenGL's:  x, y ∈ [−1, 1] and z ∈ [0, 1]
 * after the perspective divide. A point on the near plane lands on z = 0,
 * a point on the far plane on z = 1. The renderer clears depth to 1.0 and
 * uses depthCompare 'less'.
 */
import { sub, cross, dot, normalize, length } from './vec3.js';

/**
 * View matrix from eye, target and up, built with two cross products.
 *
 *   w = normalize(eye − target)      camera +z (it looks down −w)
 *   u = normalize(up × w)            camera +x   ← cross product 1
 *   v = w × u                        camera +y   ← cross product 2 (already unit)
 *
 * The camera-to-world matrix is [u v w | eye]; it is rigid, so the view
 * matrix is its inverse  [uᵀ; vᵀ; wᵀ] with translation (−u·eye, −v·eye, −w·eye).
 *
 * Degenerate case: if up ∥ (target − eye), up × w = 0 and normalising it gives
 * NaN. We then cross with a helper axis that is guaranteed not to be parallel.
 */
export function lookAt(eye, target, up) {
  const w = normalize(sub(eye, target));
  let u = cross(up, w);
  if (length(u) < 1e-6) {
    // pick the world axis least aligned with w
    const helper = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    u = cross(helper, w);
  }
  u = normalize(u);
  const v = cross(w, u);
  const m = new Float32Array(16);
  // rows of the rotation are u, v, w → stored column by column
  m[0] = u[0]; m[4] = u[1]; m[8] = u[2];
  m[1] = v[0]; m[5] = v[1]; m[9] = v[2];
  m[2] = w[0]; m[6] = w[1]; m[10] = w[2];
  m[12] = -dot(u, eye);
  m[13] = -dot(v, eye);
  m[14] = -dot(w, eye);
  m[15] = 1;
  return m;
}

/**
 * Perspective projection; depth mapped to [0, 1].
 *
 * With f = 1 / tan(fovY / 2) and a view-space point (x, y, z), z < 0:
 *   x_clip = f/aspect · x,   y_clip = f · y,   w_clip = −z
 *   z_clip = A·z + B  with  A = far / (near − far),  B = near·far / (near − far)
 * Check: z = −near → (−A·near + B)/near = 0;  z = −far → (−A·far + B)/far = 1.
 */
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = far / (near - far);
  m[11] = -1; // w_clip = −z_view
  m[14] = (near * far) / (near - far);
  return m;
}

/**
 * Orthographic projection of the view-space box
 * [left, right] × [bottom, top] × [−near, −far]; depth mapped to [0, 1].
 * Every axis is a linear map:  x → 2(x − l)/(r − l) − 1,  same for y,
 * z = −near → 0 and z = −far → 1  ⇒  z_ndc = (z + near) / (near − far).
 */
export function orthographic(left, right, bottom, top, near, far) {
  const m = new Float32Array(16);
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = 1 / (near - far);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = near / (near - far);
  m[15] = 1;
  return m;
}
