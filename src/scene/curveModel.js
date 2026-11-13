// Holds the traced curve and turns it into samples. All evaluation is done by
// the functions in src/math/curves.js; this file only decides which
// segment a global parameter falls into and loops over samples.
import * as C from '../math/curves.js';

// Default trace: the upper outline of the melon in Kavunlu Natürmort, in image
// pixels (720 × 502, y down). Indices 0, 3, 6, 9 are knots; handles around
// each interior knot are already mirrored, so the curve starts out C¹.
const PIXEL_TRACE = [
  [196, 128], [222, 62], [310, 50],
  [400, 54], [490, 58], [585, 82],
  [618, 140], [651, 198], [648, 236],
  [630, 272],
];
export const DEFAULT_POINTS = PIXEL_TRACE.map(([x, y]) => [+(x / 720).toFixed(4), +(1 - y / 502).toFixed(4)]);

export class CurveModel {
  constructor() {
    this.mode = 'bezier'; // 'bezier' | 'catmull'
    this.version = 0; // bumped on every edit (to rebuild derived meshes)
    this.reset();
  }

  reset() {
    this.points = DEFAULT_POINTS.map((p) => [...p]);
    this.touch();
  }

  touch() {
    this.version++;
  }

  isKnot(i) {
    return i % 3 === 0;
  }

  knots() {
    return this.points.filter((_, i) => i % 3 === 0);
  }

  get segments() {
    if (this.mode === 'bezier') return Math.max(0, Math.floor((this.points.length - 1) / 3));
    return Math.max(0, this.knots().length - 1);
  }

  /** Global s ∈ [0, 1] → [segment index, local t]. */
  locate(s) {
    const n = this.segments;
    const x = Math.min(n - 1e-9, Math.max(0, s) * n);
    const i = Math.floor(x);
    return [i, x - i];
  }

  /** The four control points of segment i. */
  segPoints(i) {
    if (this.mode === 'bezier') return this.points.slice(3 * i, 3 * i + 4);
    const K = this.knots(), n = K.length - 1;
    return [K[Math.max(0, i - 1)], K[i], K[i + 1], K[Math.min(n, i + 2)]];
  }

  evalSeg(i, t) {
    const q = this.segPoints(i);
    if (this.mode === 'bezier') return { p: C.bezier(...q, t), d: C.bezierTangent(...q, t) };
    return { p: C.catmullRom(...q, t), d: C.catmullRomTangent(...q, t) };
  }

  evalAt(s) {
    const [i, t] = this.locate(s);
    return this.evalSeg(i, t);
  }

  /** Samples along the whole curve (perSeg per segment, end point included). */
  sample(perSeg = 48) {
    const out = [];
    const n = this.segments;
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < perSeg; k++) out.push(this.evalSeg(i, k / perSeg).p);
    }
    if (n > 0) out.push(this.evalSeg(n - 1, 1).p);
    return out;
  }

  /** C¹ residual at each interior knot: |P_after − (2K − P_before)|. */
  c1Residuals() {
    const r = [];
    for (let k = 3; k + 1 < this.points.length; k += 3) {
      const K = this.points[k], a = this.points[k - 1], b = this.points[k + 1];
      r.push(Math.hypot(b[0] - (2 * K[0] - a[0]), b[1] - (2 * K[1] - a[1])));
    }
    return r;
  }

  toJSON() {
    return {
      painting: { artist: 'Şeker Ahmed Paşa', title: 'Kavunlu Natürmort', collection: 'Sakıp Sabancı Museum' },
      coordinates: 'normalised painting coordinates: (0,0) = bottom-left, (1,1) = top-right',
      curveType: this.mode === 'bezier' ? 'piecewise cubic Bezier' : 'uniform Catmull-Rom through the knots',
      segments: this.segments,
      continuity: 'C1: handles mirrored about every interior knot (P[k+1] = 2 P[k] - P[k-1])',
      layout: 'knots at indices 0, 3, 6, ...; segment i uses controlPoints[3i .. 3i+3]',
      controlPoints: this.points.map((p, i) => ({ i, x: +p[0].toFixed(4), y: +p[1].toFixed(4), role: i % 3 === 0 ? 'knot' : 'handle' })),
      exportedAt: new Date().toISOString(),
    };
  }
}
