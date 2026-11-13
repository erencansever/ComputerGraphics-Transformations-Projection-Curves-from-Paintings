/**
 * Part A — my 4×4 matrix library.
 *
 * Conventions I stick to everywhere in the project:
 *   • A matrix is a Float32Array(16) in COLUMN-MAJOR order:
 *       element (row r, column c)  ==  m[c * 4 + r]
 *     so the translation of an affine matrix ends up in m[12], m[13], m[14].
 *     I picked this layout because it is exactly what WGSL's mat4x4f expects,
 *     so I can upload my matrices to the uniform buffer without transposing.
 *   • Column vectors:  p' = M · p.  multiply(A, B) is A·B, so B acts first.
 *   • Right-handed world, y up, angles in radians.
 *   • I build model matrices as M = T · R · S (only the Part A switch uses S·R·T).
 */

/** The 4×4 identity: ones on the diagonal (indices 0, 5, 10, 15). */
export function identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/**
 * Returns a · b without touching a or b.
 * The usual (a·b)[r][c] = Σ_k a[r][k] · b[k][c]; the only thing to get right
 * is the indexing, since a[r][k] lives at a[k*4 + r] in column-major order.
 */
export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

/** Translation by (tx, ty, tz): identity with t in the 4th column. */
export function translate(tx, ty, tz) {
  const m = identity();
  m[12] = tx;
  m[13] = ty;
  m[14] = tz;
  return m;
}

/**
 * Rotation by `rad` about +x (right-handed, so y turns towards z).
 *   | 1  0   0 |
 *   | 0  c  −s |      I fill it column by column: (1,0,0), (0,c,s), (0,−s,c)
 *   | 0  s   c |
 */
export function rotateX(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = identity();
  m[5] = c; m[6] = s;
  m[9] = -s; m[10] = c;
  return m;
}

/**
 * Rotation by `rad` about +y (z turns towards x).
 *   |  c  0  s |
 *   |  0  1  0 |      columns: (c,0,−s), (0,1,0), (s,0,c)
 *   | −s  0  c |
 * Note the minus sign sits in the bottom-left here, not top-right like for
 * x and z, because the cyclic order is z → x (the "Ry: z→x" test checks it).
 */
export function rotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = identity();
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  return m;
}

/**
 * Rotation by `rad` about +z (x turns towards y).
 *   | c  −s  0 |
 *   | s   c  0 |      columns: (c,s,0), (−s,c,0), (0,0,1)
 *   | 0   0  1 |
 */
export function rotateZ(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = identity();
  m[0] = c; m[1] = s;
  m[4] = -s; m[5] = c;
  return m;
}

/** Non-uniform scale: just the diagonal. */
export function scale(sx, sy, sz) {
  const m = identity();
  m[0] = sx;
  m[5] = sy;
  m[10] = sz;
  return m;
}

/** Transpose: swap row r with column r. */
export function transpose(m) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[r * 4 + c] = m[c * 4 + r];
  return o;
}

/**
 * Inverse of a RIGID transform A = [R | t] (rotation + translation, no scale).
 * The handout says not to write a general inverse, and it isn't needed:
 * R is orthonormal, so R⁻¹ = Rᵀ, and from p' = R·p + t I get
 *     p = Rᵀ·(p' − t) = Rᵀ·p' − Rᵀ·t      ⇒   A⁻¹ = [Rᵀ | −Rᵀ·t]
 * I use this to turn the camera's view matrix back into camera-to-world when
 * I draw the frustum.
 */
export function invertRigid(m) {
  const o = identity();
  // upper-left 3×3 becomes Rᵀ
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];
  // new translation = −Rᵀ·t (o already holds Rᵀ, so I can multiply with it)
  const tx = m[12], ty = m[13], tz = m[14];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * tx + o[4 + r] * ty + o[8 + r] * tz);
  return o;
}

/**
 * Applies m to the point [x, y, z] with w = 1. If the result has w ≠ 1
 * (after a projection) I divide by w, so the same helper works for both.
 */
export function transformPoint(m, p) {
  const [x, y, z] = p;
  const X = m[0] * x + m[4] * y + m[8] * z + m[12];
  const Y = m[1] * x + m[5] * y + m[9] * z + m[13];
  const Z = m[2] * x + m[6] * y + m[10] * z + m[14];
  const W = m[3] * x + m[7] * y + m[11] * z + m[15];
  return W !== 1 && W !== 0 ? [X / W, Y / W, Z / W] : [X, Y, Z];
}
