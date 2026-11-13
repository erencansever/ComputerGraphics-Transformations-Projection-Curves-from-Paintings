/**
 * Part D — curves.
 *
 * Points are plain arrays of any dimension ([x, y] in the painting plane is
 * what the app uses: normalised coordinates, (0,0) = bottom-left of the
 * painting, (1,1) = top-right). Everything works component-wise, so 2D and 3D
 * both work.
 *
 * A piecewise cubic Bézier is stored as one flat list
 *     [K0, H, H, K1, H, H, K2, H, H, K3, ...]      (length 3n + 1, n segments)
 * where indices 0, 3, 6, … are knots (on the curve) and the others handles.
 * Segment i uses points[3i .. 3i+3].
 *
 * The Catmull–Rom spline passes through the knots (indices 0, 3, 6, …).
 */

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

/**
 * Cubic Bézier point B(t), t ∈ [0, 1], in Bernstein form:
 *   B(t) = (1−t)³ P0 + 3(1−t)² t P1 + 3(1−t) t² P2 + t³ P3
 * At t = 0 only the first basis function is non-zero (it equals 1) → B(0) = P0;
 * at t = 1 only the last one is → B(1) = P3.
 */
export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return p0.map((_, i) => b0 * p0[i] + b1 * p1[i] + b2 * p2[i] + b3 * p3[i]);
}

/**
 * Derivative of the cubic Bézier:
 *   B'(t) = 3(1−t)² (P1−P0) + 6(1−t)t (P2−P1) + 3t² (P3−P2)
 * so B'(0) = 3(P1 − P0) and B'(1) = 3(P3 − P2).
 */
export function bezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
  return p0.map((_, i) => a * (p1[i] - p0[i]) + b * (p2[i] - p1[i]) + c * (p3[i] - p2[i]));
}

/**
 * de Casteljau: repeatedly interpolate neighbouring points by t until one
 * point is left. Returns every level: [[4 points], [3], [2], [1]].
 */
export function deCasteljau(points, t) {
  const levels = [points.map((p) => [...p])];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next = [];
    for (let k = 0; k + 1 < prev.length; k++) next.push(lerp(prev[k], prev[k + 1], t));
    levels.push(next);
  }
  return levels;
}

/**
 * Enforces C¹ continuity, IN PLACE, at every interior knot k = 3, 6, …
 *
 * Segment s ends with tangent 3(K − P_before), segment s+1 starts with
 * tangent 3(P_after − K). C¹ ⇔ these are equal ⇔  P_after = 2K − P_before.
 *
 *   • movedIndex === k + 1  → the handle before the joint (k − 1) follows.
 *   • otherwise             → the handle after the joint (k + 1) follows.
 */
export function enforceC1(points, movedIndex) {
  for (let k = 3; k + 1 < points.length; k += 3) {
    const K = points[k];
    if (movedIndex === k + 1) {
      points[k - 1] = K.map((x, i) => 2 * x - points[k + 1][i]);
    } else {
      points[k + 1] = K.map((x, i) => 2 * x - points[k - 1][i]);
    }
  }
  return points;
}

/**
 * Uniform Catmull–Rom segment between p1 (t = 0) and p2 (t = 1):
 *   C(t) = ½ [ 2p1 + (−p0 + p2) t + (2p0 − 5p1 + 4p2 − p3) t² + (−p0 + 3p1 − 3p2 + p3) t³ ]
 * Tangent at a knot is half the chord between its neighbours: C'(0) = (p2 − p0)/2.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return p0.map((_, i) =>
    0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

/** Derivative of the Catmull–Rom segment with respect to t. */
export function catmullRomTangent(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return p0.map((_, i) =>
    0.5 * ((-p0[i] + p2[i]) + 2 * (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t + 3 * (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t2));
}

/**
 * BONUS — least-squares fit of ONE cubic Bézier to hand-traced samples.
 *
 * P0 and P3 are fixed to the first and last sample. Each sample s_i gets a
 * parameter t_i by chord length. We minimise
 *     E(P1, P2) = Σ_i | b0 P0 + b1 P1 + b2 P2 + b3 P3 − s_i |²
 * Setting ∂E/∂P1 = ∂E/∂P2 = 0 gives a 2×2 linear system (per coordinate):
 *     [Σb1²   Σb1b2] [P1]   [Σ b1 q_i]
 *     [Σb1b2  Σb2² ] [P2] = [Σ b2 q_i],    q_i = s_i − b0 P0 − b3 P3
 */
export function fitCubicBezier(samples) {
  const n = samples.length;
  if (n < 4) throw new Error('need at least 4 samples');
  const P0 = [...samples[0]], P3 = [...samples[n - 1]];
  const dim = P0.length;

  // chord-length parametrisation
  const d = [0];
  for (let i = 1; i < n; i++) {
    let s = 0;
    for (let j = 0; j < dim; j++) s += (samples[i][j] - samples[i - 1][j]) ** 2;
    d.push(d[i - 1] + Math.sqrt(s));
  }
  const total = d[n - 1] || 1;

  let a11 = 0, a12 = 0, a22 = 0;
  const r1 = new Array(dim).fill(0), r2 = new Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    const t = d[i] / total, u = 1 - t;
    const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    a11 += b1 * b1; a12 += b1 * b2; a22 += b2 * b2;
    for (let j = 0; j < dim; j++) {
      const q = samples[i][j] - b0 * P0[j] - b3 * P3[j];
      r1[j] += b1 * q;
      r2[j] += b2 * q;
    }
  }
  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-12) {
    // degenerate (e.g. all samples identical): fall back to thirds of the chord
    return [P0, lerp(P0, P3, 1 / 3), lerp(P0, P3, 2 / 3), P3];
  }
  const P1 = r1.map((_, j) => (a22 * r1[j] - a12 * r2[j]) / det);
  const P2 = r1.map((_, j) => (a11 * r2[j] - a12 * r1[j]) / det);
  return [P0, P1, P2, P3];
}
