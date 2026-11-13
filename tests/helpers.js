import assert from 'node:assert/strict';

export const EPS = 1e-5;

export function near(a, b, msg = '', eps = EPS) {
  assert.ok(Math.abs(a - b) <= eps, `${msg} expected ${b}, got ${a}`);
}

export function nearArr(a, b, msg = '', eps = EPS) {
  assert.equal(a.length, b.length, `${msg} length`);
  for (let i = 0; i < b.length; i++) near(a[i], b[i], `${msg}[${i}]`, eps);
}

/** Column-major 4×4 times homogeneous vec4. I wrote this separately from src/ on purpose, so a bug in my multiply() cannot hide itself in the tests. */
export function mulVec4(m, v) {
  const o = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r] += m[c * 4 + r] * v[c];
  return o;
}

/** Applies m to a point and does the perspective divide. */
export function project(m, p) {
  const c = mulVec4(m, [p[0], p[1], p[2], 1]);
  return [c[0] / c[3], c[1] / c[3], c[2] / c[3]];
}

export const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Runs fn; skips the test when the bonus function is still a TODO. */
export function bonus(t, fn) {
  try {
    fn();
  } catch (e) {
    if (e && e.name === 'Error' && String(e.message).startsWith('TODO')) t.skip('bonus not implemented');
    else throw e;
  }
}
