/**
 * Part D — my curve functions.
 *
 * I keep points as plain arrays and do everything component-wise, so the same
 * code works for 2D and 3D. In the app the points are [x, y] in normalised
 * painting coordinates: (0,0) is the bottom-left of the painting, (1,1) the
 * top-right.
 *
 * I store a piecewise cubic Bézier as one flat list
 *     [K0, H, H, K1, H, H, K2, H, H, K3, ...]      (3n + 1 points for n segments)
 * Indices 0, 3, 6, … are knots (on the curve), the rest are handles, and
 * segment i uses points[3i .. 3i+3]. Neighbouring segments share their knot.
 *
 * My Catmull–Rom spline goes through the knots only (indices 0, 3, 6, …).
 */

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);

/**
 * Cubic Bézier point B(t), t ∈ [0, 1], in Bernstein form:
 *   B(t) = (1−t)³ P0 + 3(1−t)² t P1 + 3(1−t) t² P2 + t³ P3
 * At t = 0 only the first basis function is non-zero (it's 1), so B(0) = P0;
 * at t = 1 only the last one is, so B(1) = P3. The proof is in my report.
 */
export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return p0.map((_, i) => b0 * p0[i] + b1 * p1[i] + b2 * p2[i] + b3 * p3[i]);
}

/**
 * Derivative of the cubic Bézier (I need it to point the arrow along the curve):
 *   B'(t) = 3(1−t)² (P1−P0) + 6(1−t)t (P2−P1) + 3t² (P3−P2)
 * so B'(0) = 3(P1 − P0) and B'(1) = 3(P3 − P2). These two end tangents are
 * what the C¹ condition below is built on.
 */
export function bezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
  return p0.map((_, i) => a * (p1[i] - p0[i]) + b * (p2[i] - p1[i]) + c * (p3[i] - p2[i]));
}

/**
 * de Casteljau: I keep interpolating neighbouring points by t until only one
 * point is left. I return every level ([[4 points], [3], [2], [1]]) because
 * the app draws the intermediate levels; the last point is B(t).
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
 * Makes the curve C¹ at every interior knot k = 3, 6, … (changes `points` in place).
 *
 * The segment before the knot ends with tangent 3(K − P_before) and the one
 * after starts with 3(P_after − K). C¹ means these are equal, so
 *     P_after = 2K − P_before
 * i.e. the two handles have to be opposite each other and the same length.
 *
 * Which handle gets fixed depends on what the user dragged:
 *   • movedIndex === k + 1  → I move the handle before the joint (k − 1)
 *   • anything else         → I move the handle after the joint (k + 1)
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
 * Uniform Catmull–Rom segment from p1 (t = 0) to p2 (t = 1), with p0 and p3
 * as the neighbours:
 *   C(t) = ½ [ 2p1 + (−p0 + p2) t + (2p0 − 5p1 + 4p2 − p3) t² + (−p0 + 3p1 − 3p2 + p3) t³ ]
 * The tangent at a knot is half the chord between its neighbours, C'(0) = (p2 − p0)/2,
 * which is why the curve passes through every knot smoothly.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return p0.map((_, i) =>
    0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
}

/** Derivative of my Catmull–Rom segment with respect to t (same polynomial, differentiated). */
export function catmullRomTangent(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return p0.map((_, i) =>
    0.5 * ((-p0[i] + p2[i]) + 2 * (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t + 3 * (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t2));
}

/**
 * BONUS — least-squares fit of ONE cubic Bézier to a hand-traced stroke.
 *
 * I fix P0 and P3 to the first and last sample, give each sample s_i a
 * parameter t_i by chord length, and minimise
 *     E(P1, P2) = Σ_i | b0 P0 + b1 P1 + b2 P2 + b3 P3 − s_i |²
 * Setting ∂E/∂P1 = ∂E/∂P2 = 0 gives a 2×2 linear system (one per coordinate):
 *     [Σb1²   Σb1b2] [P1]   [Σ b1 q_i]
 *     [Σb1b2  Σb2² ] [P2] = [Σ b2 q_i],    q_i = s_i − b0 P0 − b3 P3
 * One chord-length pass isn't a perfect fit (the real Bézier parameter isn't
 * proportional to arc length), but it's close; see "what went wrong" in my report.
 */
export function fitCubicBezier(samples) {
  const n = samples.length;
  if (n < 4) throw new Error('need at least 4 samples');
  const P0 = [...samples[0]], P3 = [...samples[n - 1]];
  const dim = P0.length;

  // chord-length parameters: cumulative distance along the stroke
  const d = [0];
  for (let i = 1; i < n; i++) {
    let s = 0;
    for (let j = 0; j < dim; j++) s += (samples[i][j] - samples[i - 1][j]) ** 2;
    d.push(d[i - 1] + Math.sqrt(s));
  }
  const total = d[n - 1] || 1;

  // accumulate the normal equations
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
    // degenerate stroke (e.g. all samples on one spot): put the handles at thirds of the chord
    return [P0, lerp(P0, P3, 1 / 3), lerp(P0, P3, 2 / 3), P3];
  }
  // solve the 2×2 system with Cramer's rule
  const P1 = r1.map((_, j) => (a22 * r1[j] - a12 * r2[j]) / det);
  const P2 = r1.map((_, j) => (a11 * r2[j] - a12 * r1[j]) / det);
  return [P0, P1, P2, P3];
}
