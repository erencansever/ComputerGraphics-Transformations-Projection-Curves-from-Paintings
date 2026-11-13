/**
 * Part C — my view and projection matrices.
 *
 * Camera convention: in view space my camera sits at the origin looking down
 * −z, with +y up and +x to the right (right-handed, same as OpenGL).
 *
 * The part that is different from the OpenGL formulas I learned first: WebGPU
 * clip space has z ∈ [0, 1] after the perspective divide, not [−1, 1].
 * So the near plane has to land on z = 0 and the far plane on z = 1.
 * My renderer clears depth to 1.0 and uses depthCompare 'less'.
 */
import { sub, cross, dot, normalize, length } from './vec3.js';

/**
 * View matrix from eye, target and up, with the two cross products the
 * handout asks for:
 *
 *   w = normalize(eye − target)      camera +z (the camera looks down −w)
 *   u = normalize(up × w)            camera +x   ← cross product 1
 *   v = w × u                        camera +y   ← cross product 2 (already unit length)
 *
 * The camera-to-world matrix would be [u v w | eye]. It's rigid, so the view
 * matrix is just its inverse: rows u, v, w and translation (−u·eye, −v·eye, −w·eye).
 *
 * Degenerate case: if up is parallel to the view direction (looking straight
 * down), up × w is the zero vector and normalising it gives NaN. When that
 * happens I cross with a helper axis that can't be parallel to w instead.
 */
export function lookAt(eye, target, up) {
  const w = normalize(sub(eye, target));
  let u = cross(up, w);
  if (length(u) < 1e-6) {
    // pick whichever world axis is least aligned with w
    const helper = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    u = cross(helper, w);
  }
  u = normalize(u);
  const v = cross(w, u);
  const m = new Float32Array(16);
  // u, v, w are the ROWS of the rotation, so in column-major they go across columns
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
 * Perspective projection with depth in [0, 1].
 *
 * With f = 1 / tan(fovY / 2) and a view-space point (x, y, z), z < 0:
 *   x_clip = f/aspect · x,   y_clip = f · y,   w_clip = −z
 *   z_clip = A·z + B
 * I need z = −near → 0 and z = −far → 1 after dividing by −z, which gives
 *   A = far / (near − far),   B = near·far / (near − far)
 * (derivation is in section 4 of my report).
 */
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = far / (near - far);
  m[11] = -1; // this makes w_clip = −z_view
  m[14] = (near * far) / (near - far);
  return m;
}

/**
 * Orthographic projection of the view-space box
 * [left, right] × [bottom, top] × [−near, −far], depth again in [0, 1].
 * Every axis is a plain linear map: x → 2(x − l)/(r − l) − 1 (same for y), and
 * for depth z = −near → 0, z = −far → 1, i.e. z_ndc = (z + near) / (near − far).
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
