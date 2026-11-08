import { test } from 'node:test';
import * as Q from '../src/math/quat.js';
import { near, nearArr, bonus } from './helpers.js';

test('BONUS quaternion rotation matches the right-hand rule', (t) => {
  bonus(t, () => {
    const q = Q.fromAxisAngle([0, 0, 1], Math.PI / 2);
    nearArr(Q.rotateVec3(q, [1, 0, 0]), [0, 1, 0]);
    const r = Q.multiply(Q.fromAxisAngle([0, 1, 0], Math.PI / 2), Q.fromAxisAngle([1, 0, 0], Math.PI / 2));
    nearArr(Q.rotateVec3(r, [0, 1, 0]), [1, 0, 0], 'apply right factor first');
  });
});

test('BONUS slerp: ends, midpoint, unit length, shortest arc', (t) => {
  bonus(t, () => {
    const a = Q.fromAxisAngle([0, 1, 0], 0), b = Q.fromAxisAngle([0, 1, 0], Math.PI / 2);
    nearArr(Q.slerp(a, b, 0), a);
    nearArr(Q.slerp(a, b, 1), b);
    const m = Q.slerp(a, b, 0.5);
    nearArr(Q.rotateVec3(m, [0, 0, 1]), [Math.SQRT1_2, 0, Math.SQRT1_2]);
    near(Math.hypot(...m), 1);
    const nb = b.map((x) => -x); // same rotation, other hemisphere
    nearArr(Q.rotateVec3(Q.slerp(a, nb, 0.5), [0, 0, 1]), [Math.SQRT1_2, 0, Math.SQRT1_2], 'shortest arc');
    nearArr(Q.normalize([0, 0, 0, 2]), [0, 0, 0, 1]);
  });
});
