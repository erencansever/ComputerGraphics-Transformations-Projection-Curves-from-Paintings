import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/math/curves.js';
import { near, nearArr, bonus } from './helpers.js';

const P = [[0, 0], [0, 1], [1, 1], [1, 0]];

test('bezier interpolates P0 and P3', () => {
  nearArr(C.bezier(...P, 0), P[0]);
  nearArr(C.bezier(...P, 1), P[3]);
  nearArr(C.bezier(...P, 0.5), [0.5, 0.75]);
  nearArr(C.bezier([0, 0, 0], [1, 0, 2], [2, 0, 2], [3, 0, 0], 0.5), [1.5, 0, 1.5], '3D');
});

test('bezierTangent at the ends is 3(P1−P0) and 3(P3−P2)', () => {
  nearArr(C.bezierTangent(...P, 0), [0, 3]);
  nearArr(C.bezierTangent(...P, 1), [0, -3]);
  nearArr(C.bezierTangent(...P, 0.5), [1.5, 0]);
});

test('deCasteljau levels end in B(t)', () => {
  const L = C.deCasteljau(P, 0.3);
  assert.deepEqual(L.map((l) => l.length), [4, 3, 2, 1]);
  nearArr(L[1][0], [0, 0.3], 'first lerp');
  nearArr(L[3][0], C.bezier(...P, 0.3));
});

const curve = () => [[0, 0], [1, 1], [2, 1], [3, 0], [4, 0], [5, 2], [6, 2], [7, 1], [7.5, 0], [8, 0]];

test('enforceC1 follows the documented contract', () => {
  const pts = curve();
  pts[2] = [2.5, 0.5]; // handle before knot 3 moved → handle after (4) follows
  C.enforceC1(pts, 2);
  nearArr(pts[4], [3.5, -0.5], 'after-handle follows');
  pts[7] = [6, 3]; // handle after knot 6 moved → handle before (5) follows
  C.enforceC1(pts, 7);
  nearArr(pts[5], [6, 1], 'before-handle follows');
  nearArr(pts[7], [6, 3], 'moved handle untouched');
});

test('enforceC1 makes neighbouring segments share the tangent at each joint', () => {
  const pts = C.enforceC1(curve());
  for (const k of [3, 6]) {
    const a = C.bezierTangent(pts[k - 3], pts[k - 2], pts[k - 1], pts[k], 1);
    const b = C.bezierTangent(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], 0);
    nearArr(a, b, `joint ${k}`);
  }
});

test('Catmull–Rom passes through p1 and p2, tangent (p2 − p0)/2', () => {
  const q = [[0, 0], [1, 2], [3, 3], [4, 1]];
  nearArr(C.catmullRom(...q, 0), q[1]);
  nearArr(C.catmullRom(...q, 1), q[2]);
  nearArr(C.catmullRomTangent(...q, 0), [1.5, 1.5]);
  nearArr(C.catmullRomTangent(...q, 1), [1.5, -0.5]);
});

test('BONUS fitCubicBezier recovers a Bézier from its samples', (t) => {
  bonus(t, () => {
    const Q = [[0, 0], [0.2, 0.9], [0.8, 1.1], [1, 0.1]];
    const samples = [];
    for (let i = 0; i <= 40; i++) samples.push(C.bezier(...Q, i / 40));
    const F = C.fitCubicBezier(samples);
    assert.equal(F.length, 4);
    nearArr(F[0], Q[0]);
    nearArr(F[3], Q[3]);
    let worst = 0;
    for (let i = 0; i <= 40; i++) {
      const s = samples[i];
      let best = Infinity;
      for (let j = 0; j <= 200; j++) {
        const p = C.bezier(...F, j / 200);
        best = Math.min(best, Math.hypot(p[0] - s[0], p[1] - s[1]));
      }
      worst = Math.max(worst, best);
    }
    // one chord-length pass gets within ~0.06 here; reparametrising gets closer
    assert.ok(worst < 0.1, `max distance ${worst}`);
  });
});
