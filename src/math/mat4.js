/**
 * Part A — 4×4 matrix library.
 *
 * Conventions used by the whole application:
 *   • A matrix is a Float32Array(16) in COLUMN-MAJOR order:
 *       element (row r, column c)  ==  m[c * 4 + r]
 *     so the translation of an affine matrix lives in m[12], m[13], m[14].
 *     This is exactly the layout WGSL's mat4x4f expects in a uniform buffer.
 *   • Column vectors:  p' = M · p.   multiply(A, B) means A·B (B is applied first).
 *   • Right-handed world, y up. Angles in radians.
 *   • Model matrices are composed as M = T · R · S unless the UI switch says S·R·T.
 */

/** @returns {Float32Array} the 4×4 identity. */
export function identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/**
 * @returns {Float32Array} the product a · b (a and b are not modified).
 * (a·b)[r][c] = Σ_k a[r][k] · b[k][c]; with column-major storage
 * a[r][k] = a[k*4 + r] and b[k][c] = b[c*4 + k].
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

/** @returns {Float32Array} translation by (tx, ty, tz) — the 4th column. */
export function translate(tx, ty, tz) {
  const m = identity();
  m[12] = tx;
  m[13] = ty;
  m[14] = tz;
  return m;
}

/**
 * Right-handed rotation of `rad` about +x (y → z).
 *   | 1  0   0 |
 *   | 0  c  −s |      columns: (1,0,0), (0,c,s), (0,−s,c)
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
 * Right-handed rotation of `rad` about +y (z → x).
 *   |  c  0  s |
 *   |  0  1  0 |      columns: (c,0,−s), (0,1,0), (s,0,c)
 *   | −s  0  c |
 */
export function rotateY(rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const m = identity();
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  return m;
}

/**
 * Right-handed rotation of `rad` about +z (x → y).
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

/** @returns {Float32Array} non-uniform scale (the diagonal). */
export function scale(sx, sy, sz) {
  const m = identity();
  m[0] = sx;
  m[5] = sy;
  m[10] = sz;
  return m;
}

/** @returns {Float32Array} the transpose of m (row r ↔ column r). */
export function transpose(m) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[r * 4 + c] = m[c * 4 + r];
  return o;
}

/**
 * Inverse of a RIGID transform  A = [R | t]  (rotation + translation, no scale).
 * Since R is orthonormal, R⁻¹ = Rᵀ, and A·p = R·p + t inverts to
 *     p = Rᵀ·(p' − t) = Rᵀ·p' − Rᵀ·t      ⇒   A⁻¹ = [Rᵀ | −Rᵀ·t]
 * No general 4×4 inverse needed.
 */
export function invertRigid(m) {
  const o = identity();
  // Rᵀ: element (r, c) of the result is element (c, r) of m
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];
  // −Rᵀ·t
  const tx = m[12], ty = m[13], tz = m[14];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * tx + o[4 + r] * ty + o[8 + r] * tz);
  return o;
}

/**
 * Applies m to the point p = [x, y, z] (w = 1) and returns [x', y', z'],
 * divided by w' when w' ≠ 1 (so it also works after a projection).
 */
export function transformPoint(m, p) {
  const [x, y, z] = p;
  const X = m[0] * x + m[4] * y + m[8] * z + m[12];
  const Y = m[1] * x + m[5] * y + m[9] * z + m[13];
  const Z = m[2] * x + m[6] * y + m[10] * z + m[14];
  const W = m[3] * x + m[7] * y + m[11] * z + m[15];
  return W !== 1 && W !== 0 ? [X / W, Y / W, Z / W] : [X, Y, Z];
}
