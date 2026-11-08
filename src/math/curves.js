/**
 * Part D — curves.                                   ★ STUDENT CODE ★
 *
 * Points are plain arrays of any dimension ([x, y] in the painting plane is
 * what the app uses: normalised coordinates, (0,0) = bottom-left of the
 * painting, (1,1) = top-right). Work component-wise so 2D and 3D both work.
 *
 * A piecewise cubic Bézier is stored as one flat list
 *     [K0, H, H, K1, H, H, K2, H, H, K3, ...]      (length 3n + 1, n segments)
 * where indices 0, 3, 6, … are knots (on the curve) and the others handles.
 * Segment i uses points[3i .. 3i+3].
 *
 * The Catmull–Rom spline passes through the knots (indices 0, 3, 6, …).
 *
 * Run `npm test` — tests/curves.test.js must pass.
 */
import { todo } from './todo.js';

/** Cubic Bézier point B(t), t ∈ [0, 1]. */
export function bezier(p0, p1, p2, p3, t) {
  return todo('curves.bezier');
}

/** Derivative B'(t) of the cubic Bézier (used to orient the moving object). */
export function bezierTangent(p0, p1, p2, p3, t) {
  return todo('curves.bezierTangent');
}

/**
 * de Casteljau construction for 4 control points at parameter t.
 * @returns {Array<Array<number[]>>} the levels: [[4 points], [3], [2], [1]].
 *   The single point of the last level equals bezier(..., t).
 */
export function deCasteljau(points, t) {
  return todo('curves.deCasteljau');
}

/**
 * Enforces C¹ continuity, IN PLACE, at every interior knot k = 3, 6, … of a
 * piecewise Bézier control list (see the layout above).
 *
 * Contract:
 *   • movedIndex === k + 1  → the handle before the joint (k − 1) follows.
 *   • any other movedIndex (or undefined) → the handle after the joint
 *     (k + 1) follows.
 * The handle that follows is set so that the two handles are opposite and of
 * equal length about the knot. Returns `points`.
 */
export function enforceC1(points, movedIndex) {
  return todo('curves.enforceC1');
}

/**
 * Uniform Catmull–Rom segment between p1 (t = 0) and p2 (t = 1);
 * p0 and p3 are the neighbours.
 */
export function catmullRom(p0, p1, p2, p3, t) {
  return todo('curves.catmullRom');
}

/** Derivative of the Catmull–Rom segment with respect to t. */
export function catmullRomTangent(p0, p1, p2, p3, t) {
  return todo('curves.catmullRomTangent');
}

/**
 * BONUS — least-squares fit of ONE cubic Bézier to hand-traced samples.
 * Keep the end points fixed at samples[0] and samples[last], parametrise the
 * samples (chord length is a good choice) and solve the 2×2 normal equations
 * for the two inner control points.
 * @param {number[][]} samples at least 4 points
 * @returns {number[][]} [P0, P1, P2, P3]
 */
export function fitCubicBezier(samples) {
  return todo('curves.fitCubicBezier');
}
