/**
 * BONUS — quaternions for the orbit camera.
 * A quaternion is [x, y, z, w] (w is the scalar part). Unit quaternions only.
 */

/** Rotation of `rad` about the (unit) axis:  q = (sin(θ/2)·axis, cos(θ/2)). */
export function fromAxisAngle(axis, rad) {
  const s = Math.sin(rad / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(rad / 2)];
}

/**
 * Hamilton product a ⊗ b (apply b first, then a):
 *   (v_a, w_a)(v_b, w_b) = (w_a v_b + w_b v_a + v_a × v_b,  w_a w_b − v_a·v_b)
 */
export function multiply(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + bw * ax + (ay * bz - az * by),
    aw * by + bw * ay + (az * bx - ax * bz),
    aw * bz + bw * az + (ax * by - ay * bx),
    aw * bw - (ax * bx + ay * by + az * bz),
  ];
}

/** Returns q / |q|. */
export function normalize(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/**
 * Spherical linear interpolation along the shorter arc.
 * q and −q are the same rotation; if a·b < 0 we flip b so we take the short
 * way round. Near-identical quaternions fall back to normalised lerp.
 */
export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) {
    b = b.map((x) => -x);
    d = -d;
  }
  if (d > 0.9995) return normalize(a.map((x, i) => x + (b[i] - x) * t));
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((x, i) => wa * x + wb * b[i]);
}

/** Rotates v by q:  v' = q ⊗ (v, 0) ⊗ q*. */
export function rotateVec3(q, v) {
  const conj = [-q[0], -q[1], -q[2], q[3]];
  const r = multiply(multiply(q, [v[0], v[1], v[2], 0]), conj);
  return [r[0], r[1], r[2]];
}
