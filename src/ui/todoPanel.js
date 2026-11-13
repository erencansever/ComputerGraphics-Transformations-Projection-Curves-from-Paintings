// Checks which maths functions are still TODO and lists them on screen.
import * as M from '../math/mat4.js';
import * as Cam from '../math/camera.js';
import * as Crv from '../math/curves.js';
import * as Q from '../math/quat.js';
import { TodoError } from '../math/todo.js';
import { WGSL_CURVES_IMPLEMENTED } from '../math/curves.wgsl.js';

const Z = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const P4 = [[0, 0], [0, 1], [1, 1], [1, 0]];
const GROUPS = [
  ['Part A — src/math/mat4.js', [
    ['mat4.identity', () => M.identity()], ['mat4.multiply', () => M.multiply(Z(), Z())], ['mat4.translate', () => M.translate(1, 2, 3)],
    ['mat4.rotateX', () => M.rotateX(1)], ['mat4.rotateY', () => M.rotateY(1)], ['mat4.rotateZ', () => M.rotateZ(1)],
    ['mat4.scale', () => M.scale(1, 2, 3)], ['mat4.transpose', () => M.transpose(Z())], ['mat4.invertRigid', () => M.invertRigid(Z())],
    ['mat4.transformPoint', () => M.transformPoint(Z(), [1, 2, 3])],
  ]],
  ['Part C — src/math/camera.js', [
    ['camera.lookAt', () => Cam.lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0])], ['camera.perspective', () => Cam.perspective(1, 1, 0.1, 10)],
    ['camera.orthographic', () => Cam.orthographic(-1, 1, -1, 1, 0.1, 10)],
  ]],
  ['Part D — src/math/curves.js', [
    ['curves.bezier', () => Crv.bezier(...P4, 0.5)], ['curves.bezierTangent', () => Crv.bezierTangent(...P4, 0.5)],
    ['curves.deCasteljau', () => Crv.deCasteljau(P4, 0.5)], ['curves.enforceC1', () => Crv.enforceC1([...P4.map((p) => [...p]), [2, 0], [2, 1], [3, 1]], 2)],
    ['curves.catmullRom', () => Crv.catmullRom(...P4, 0.5)], ['curves.catmullRomTangent', () => Crv.catmullRomTangent(...P4, 0.5)],
  ]],
  ['Bonus (optional)', [
    ['curves.fitCubicBezier', () => Crv.fitCubicBezier([[0, 0], [0.3, 0.5], [0.6, 0.6], [0.8, 0.4], [1, 0]])],
    ['quat.fromAxisAngle', () => Q.fromAxisAngle([0, 1, 0], 1)], ['quat.multiply', () => Q.multiply([0, 0, 0, 1], [0, 0, 0, 1])],
    ['quat.normalize', () => Q.normalize([0, 0, 0, 2])], ['quat.slerp', () => Q.slerp([0, 0, 0, 1], [0, 0, 0, 1], 0.5)],
    ['quat.rotateVec3', () => Q.rotateVec3([0, 0, 0, 1], [1, 0, 0])],
  ]],
];

export function probe() {
  const missing = [];
  const groups = GROUPS.map(([title, fns]) => {
    const m = [];
    for (const [name, call] of fns) {
      try { call(); } catch (e) { if (e instanceof TodoError) { m.push(name); missing.push(name); } }
    }
    return [title, m];
  });
  if (!WGSL_CURVES_IMPLEMENTED) groups[3][1].push('curves.wgsl.js (bezier_point / bezier_tangent)');
  return { missing, groups };
}

export function renderTodo(app) {
  const box = document.getElementById('todo');
  const g = app.probe?.groups.filter(([, m]) => m.length) || [];
  const required = g.filter(([t]) => !t.startsWith('Bonus'));
  if (!required.length && !app.fatal) { box.style.display = 'none'; return; }
  if (box.dataset.sig === JSON.stringify([g, app.fatal])) { box.style.display = 'block'; return; }
  box.dataset.sig = JSON.stringify([g, app.fatal]);
  box.innerHTML =
    `<h3>Maths still to write</h3>` +
    (app.fatal ? `<p>${app.fatal}. The scene appears as soon as Part A and Part C are done.</p>` : '') +
    g.map(([t, m]) => `<b>${t}</b><ul>${m.map((f) => `<li><code>${f}</code></li>`).join('')}</ul>`).join('') +
    `<p>Run <code>npm test</code> to check them. This box disappears once Parts A, C and D are done.</p>`;
  box.style.display = 'block';
}
