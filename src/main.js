// CS405 Project 1 — one WebGPU application for parts A–E.
//
//   math/    maths (mat4, camera, curves, quaternions) + vec3 helpers
//   scene/   scene-graph node, the scene itself, meshes, the curve model
//   render/  WebGPU device, pipelines, shaders, compute ribbon
//   ui/      panel, HUD, orbit camera, mouse picking
//
// Per frame:  update animation → local matrices → world matrices (traversal)
//             → V, P for each camera → draw lists → one command buffer.
import * as M from './math/mat4.js';
import * as Cam from './math/camera.js';
import * as Crv from './math/curves.js';
import { TodoError } from './math/todo.js';
import { WGSL_CURVES_IMPLEMENTED } from './math/curves.wgsl.js';
import { Renderer, FloatList } from './render/renderer.js';
import { GpuRibbon } from './render/gpuRibbon.js';
import { srgb } from './render/color.js';
import * as Mesh from './scene/meshes.js';
import { buildScene, updateScene, PAINT } from './scene/sceneGraph.js';
import { CurveModel } from './scene/curveModel.js';
import { freshState } from './state.js';
import { Orbit, VIEWPOINTS } from './ui/orbit.js';
import { paintToWorld } from './ui/picking.js';
import { buildPanel } from './ui/panel.js';
import { attachInput } from './ui/input.js';
import { probe, renderTodo } from './ui/todoPanel.js';
import { renderHud, renderInfo } from './ui/info.js';

const COL = {
  curve: srgb('#ffd54a'), curveCR: srgb('#ff9f43'), poly: srgb('#d9d4c8'), knot: srgb('#b4441c'), handle: srgb('#ffffff'),
  outline: srgb('#000000'), active: srgb('#4dd0ff'), lvl: [srgb('#6fb3e0'), srgb('#7cc478'), srgb('#f07a4a')], fit: srgb('#33e0d0'),
  free: srgb('#ffffff'), grid: srgb('#4a4640'), x: srgb('#e0453a'), y: srgb('#3fbf5f'), z: srgb('#3a8be0'), frustum: srgb('#ff6b3d'),
  pipBg: srgb('#1d1a17'), pipBorder: srgb('#ffd54a'), place: srgb('#4dd0ff'),
};
const INSPECT = { eye: [7.5, 6.2, 9.5], target: [0, 1.0, 1.0], fovDeg: 45 };

const app = {
  st: freshState(),
  curve: new CurveModel(),
  orbit: new Orbit(),
  scene: null,
  renderer: null,
  ribbon: null,
  lines: new FloatList(1 << 16),
  tris: new FloatList(1 << 17),
  animTime: 0,
  paused: false,
  placeMode: false,
  placeBackup: null,
  drag: { index: -1, hover: -1 },
  free: { samples: [], fit: null, active: false, error: '' },
  sweepKey: '',
  frameMs: [],
  cams: {},
  views: {},
  errors: new Set(),
  quatOK: false,
};
window.app = app; // handy in the devtools console

// ---------------------------------------------------------------------------
function safe(label, fn, fallback) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof TodoError) app.errors.add(e.fn);
    else { app.errors.add(`${label}: ${e.message}`); if (!safe.logged?.has(label)) { (safe.logged ??= new Set()).add(label); console.error(e); } }
    return fallback;
  }
}

function viewports() {
  const W = app.renderer.canvas.width, H = app.renderer.canvas.height;
  const m = Math.round(10 * (W / app.renderer.canvas.clientWidth));
  switch (app.st.viewMode) {
    case 'main': return { main: [0, 0, W, H], inspect: null };
    case 'inspect': return { main: null, inspect: [0, 0, W, H] };
    case 'split': return { main: [0, 0, Math.floor(W / 2), H], inspect: [Math.floor(W / 2), 0, W - Math.floor(W / 2), H] };
    default: {
      const pw = Math.round(W * 0.34), ph = Math.round(H * 0.34);
      return { main: [0, 0, W, H], inspect: [W - pw - m, H - ph - m, pw, ph] };
    }
  }
}

/** Main camera: eye/target/up from the orbit, V = lookAt, P = perspective | orthographic. */
function mainCamera(aspect) {
  const st = app.st;
  const useQuat = st.useQuat && app.quatOK;
  const { eye, up } = safe('quaternion orbit', () => app.orbit.eyeUp(useQuat), null) || app.orbit.eyeUp(false);
  const target = app.orbit.target;
  const fovY = (st.fovDeg * Math.PI) / 180;
  const V = Cam.lookAt(eye, target, up);
  let P;
  if (st.proj === 'ortho') {
    const hh = st.orthoHeight / 2, hw = hh * aspect;
    P = Cam.orthographic(-hw, hw, -hh, hh, st.near, st.far);
  } else {
    P = Cam.perspective(fovY, aspect, st.near, st.far);
  }
  return { eye, target, up, fovY, aspect, ortho: st.proj === 'ortho', orthoHeight: st.orthoHeight, near: st.near, far: st.far, V, P, VP: M.multiply(P, V) };
}

function inspectionCamera(aspect) {
  const V = Cam.lookAt(INSPECT.eye, INSPECT.target, [0, 1, 0]);
  const P = Cam.perspective((INSPECT.fovDeg * Math.PI) / 180, aspect, 0.1, 100);
  return { eye: INSPECT.eye, target: INSPECT.target, V, P, VP: M.multiply(P, V) };
}

// ---------------------------------------------------------------------------
// Overlay geometry (world space, rebuilt every frame)
function line(a, b, c) { app.lines.v(a, c); app.lines.v(b, c); }
function tri(a, b, c, col) { app.tris.v(a, col); app.tris.v(b, col); app.tris.v(c, col); }
function disc(center, r, col, seg = 14) {
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 2 * Math.PI, a1 = ((i + 1) / seg) * 2 * Math.PI;
    tri(center, [center[0] + r * Math.cos(a0), center[1] + r * Math.sin(a0), center[2]], [center[0] + r * Math.cos(a1), center[1] + r * Math.sin(a1), center[2]], col);
  }
}
function square(center, r, col) {
  const [x, y, z] = center;
  tri([x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], col);
  tri([x - r, y - r, z], [x + r, y + r, z], [x - r, y + r, z], col);
}
/** Thick polyline in the painting plane (points already in world space). */
function ribbon(world, halfW, col) {
  const n = world.length;
  if (n < 2) return;
  const off = world.map((p, i) => {
    const a = world[Math.max(0, i - 1)], b = world[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    return [p[0] - ty * halfW, p[1] + tx * halfW, p[0] + ty * halfW, p[1] - tx * halfW];
  });
  for (let i = 0; i + 1 < n; i++) {
    const z = world[i][2], A = off[i], B = off[i + 1];
    const a1 = [A[0], A[1], z], a2 = [A[2], A[3], z], b1 = [B[0], B[1], z], b2 = [B[2], B[3], z];
    tri(a1, a2, b1, col);
    tri(a2, b2, b1, col);
  }
}

function buildGridAndAxes() {
  const { st, scene } = app;
  if (st.debug.grid) {
    for (let x = -2.8; x <= 2.81; x += 0.4) line([x, 0.003, 0], [x, 0.003, 3.2], COL.grid);
    for (let z = 0; z <= 3.21; z += 0.4) line([-2.8, 0.003, z], [2.8, 0.003, z], COL.grid);
    line([0, 0.004, 0], [1, 0.004, 0], COL.x); line([0, 0, 0], [0, 1, 0], COL.y); line([0, 0.004, 0], [0, 0.004, 1], COL.z);
  }
  if (st.debug.axes) {
    scene.root.traverse((node) => {
      if (!node.visible) return;
      const o = M.transformPoint(node.world, [0, 0, 0]);
      const L = node === scene.root || node.name === 'table' || node.name === 'painting' ? 0.6 : node.name.startsWith('frame-') ? 0.2 : 0.3;
      line(o, M.transformPoint(node.world, [L, 0, 0]), COL.x);
      line(o, M.transformPoint(node.world, [0, L, 0]), COL.y);
      line(o, M.transformPoint(node.world, [0, 0, L]), COL.z);
    });
  }
}

function buildCurveOverlay() {
  const { st, curve } = app;
  const Z = (dz) => (p) => paintToWorld(p, dz);
  const pts = curve.points;
  const bez = curve.mode === 'bezier';

  if (app.placeMode) {
    for (let i = 0; i + 1 < pts.length; i++) line(Z(0.015)(pts[i]), Z(0.015)(pts[i + 1]), COL.place);
    pts.forEach((p, i) => (i % 3 === 0 ? disc(Z(0.02)(p), 0.045, COL.knot) : square(Z(0.02)(p), 0.03, COL.handle)));
    return;
  }

  // the curve itself
  const useGpu = st.curve.gpuRibbon && WGSL_CURVES_IMPLEMENTED && bez;
  if (!useGpu) {
    safe('curve sampling', () => ribbon(curve.sample(48).map(Z(0.01)), 0.018, bez ? COL.curve : COL.curveCR));
  }

  // control polygon
  if (st.debug.polygon && bez) {
    for (let i = 0; i + 1 < pts.length; i++) line(Z(0.014)(pts[i]), Z(0.014)(pts[i + 1]), COL.poly);
  }

  // de Casteljau for the active segment at the global parameter t
  if (st.debug.casteljau && bez && curve.segments > 0) {
    safe('de Casteljau', () => {
      const [i, t] = curve.locate(st.curve.t);
      const levels = Crv.deCasteljau(curve.segPoints(i), t);
      for (let d = 1; d < levels.length; d++) {
        const lv = levels[d].map(Z(0.016 + d * 0.001));
        for (let k = 0; k + 1 < lv.length; k++) line(lv[k], lv[k + 1], COL.lvl[d - 1]);
        lv.forEach((p) => disc(p, d === 3 ? 0.04 : 0.022, d === 3 ? COL.active : COL.lvl[d - 1], 10));
      }
    });
  }

  // control points (knots round, handles square)
  if (st.debug.points) {
    pts.forEach((p, i) => {
      const knot = i % 3 === 0;
      if (!bez && !knot) return;
      const hot = i === app.drag.index || i === app.drag.hover;
      const c = Z(0.02)(p), cb = Z(0.019)(p);
      if (knot) { disc(cb, 0.055, COL.outline); disc(c, 0.045, hot ? COL.active : COL.knot); }
      else { square(cb, 0.038, COL.outline); square(c, 0.03, hot ? COL.active : COL.handle); }
    });
  }

  // freehand trace + least-squares fit (bonus)
  const fr = app.free;
  if (fr.samples.length > 1) for (let i = 0; i + 1 < fr.samples.length; i++) line(Z(0.017)(fr.samples[i]), Z(0.017)(fr.samples[i + 1]), COL.free);
  if (fr.fit && st.curve.showFit) {
    safe('fit display', () => {
      const s = [];
      for (let k = 0; k <= 64; k++) s.push(Crv.bezier(...fr.fit, k / 64));
      ribbon(s.map(Z(0.012)), 0.012, COL.fit);
      for (let i = 0; i < 3; i++) line(Z(0.015)(fr.fit[i]), Z(0.015)(fr.fit[i + 1]), COL.fit);
      fr.fit.forEach((p) => square(Z(0.02)(p), 0.025, COL.fit));
    });
  }
}

/** Main camera frustum + its axes, for the inspection view only. */
function buildFrustum(cam) {
  const invV = M.invertRigid(cam.V);
  const corners = (d) => {
    const hh = cam.ortho ? cam.orthoHeight / 2 : Math.tan(cam.fovY / 2) * d, hw = hh * cam.aspect;
    return [[-hw, -hh, -d], [hw, -hh, -d], [hw, hh, -d], [-hw, hh, -d]].map((p) => M.transformPoint(invV, p));
  };
  const n = corners(cam.near), f = corners(cam.far);
  for (let k = 0; k < 4; k++) {
    line(n[k], n[(k + 1) % 4], COL.frustum);
    line(f[k], f[(k + 1) % 4], COL.frustum);
    line(n[k], f[k], COL.frustum);
    if (!cam.ortho) line(cam.eye, n[k], COL.frustum);
  }
  const e = M.transformPoint(invV, [0, 0, 0]);
  line(e, M.transformPoint(invV, [0.5, 0, 0]), COL.x);
  line(e, M.transformPoint(invV, [0, 0.5, 0]), COL.y);
  line(e, M.transformPoint(invV, [0, 0, 0.5]), COL.z);
  line(e, cam.target, COL.poly);
}

// ---------------------------------------------------------------------------
function updateCurveRider() {
  const { curve, st, scene } = app;
  const rider = scene.nodes.rider;
  rider.visible = false;
  if (app.placeMode || curve.segments < 1) return;
  safe('curve rider', () => {
    const { p, d } = curve.evalAt(st.curve.t);
    const w = paintToWorld(p, 0.07);
    // tangent is in normalised coords; scale to world units before atan2
    const ang = Math.atan2(d[1] * PAINT.H, d[0] * PAINT.W);
    rider.local = M.multiply(M.translate(...w), M.rotateZ(ang));
    rider.describe = () => `T(C(t))·R_z(atan2(C'(t)) = ${ang.toFixed(2)})`;
    rider.visible = true;
  });
}

function updateSweep() {
  const { curve, st, scene, renderer } = app;
  const node = scene.nodes.sweep;
  node.visible = st.curve.sweep && !app.placeMode;
  const key = `${curve.version}|${curve.mode}`;
  if (!node.visible || app.sweepKey === key) return;
  safe('surface of revolution', () => {
    const s = curve.sample(32);
    if (s.length < 2) return;
    // Profile in world units: x along the traced shape (centred), radius =
    // height above the lower end point of the trace. Swept around x.
    const vAxis = Math.min(s[0][1], s[s.length - 1][1]);
    const xs = s.map((p) => p[0] * PAINT.W), xMid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const prof = s.map(([u, v], i) => [xs[i] - xMid, Math.max(0, (v - vAxis) * PAINT.H)]);
    const len = Math.max(...xs) - Math.min(...xs), rMax = Math.max(...prof.map((p) => p[1]));
    renderer.setMesh('sweep', Mesh.revolve(prof, 48));
    const k = 0.8 / Math.max(len, 2 * rMax, 1e-3);
    node.local = M.multiply(M.translate(0.85, 0.05 + rMax * k, -0.95), M.scale(k, k, k));
    node.describe = () => `T(0.85, ${(0.05 + rMax * k).toFixed(2)}, −0.95)·S(${k.toFixed(2)})`;
    app.sweepKey = key;
  });
}

// ---------------------------------------------------------------------------
function sceneDraws(cache) {
  return cache.map((d) => ({ ...d }));
}

function frame(now) {
  const dt = Math.min(0.1, (now - (app.last ?? now)) / 1000);
  if (app.last !== undefined) { app.frameMs.push(now - app.last); if (app.frameMs.length > 60) app.frameMs.shift(); }
  app.last = now;
  app.errors.clear();
  try {
    tick(dt);
    app.fatal = null;
  } catch (e) {
    app.fatal = e instanceof TodoError ? `Rendering needs ${e.fn}` : e.message;
    if (!(e instanceof TodoError)) console.error(e);
    if (e instanceof TodoError) app.errors.add(e.fn);
  }
  if (now - (app.hudAt || 0) > 120) { app.hudAt = now; renderHud(app); renderInfo(app); app.panel?.tick(); renderTodo(app); }
  requestAnimationFrame(frame);
}

function tick(dt) {
  const { st, renderer } = app;
  renderer.resize();
  app.orbit.update(dt);
  if (!app.paused) {
    if (st.partB.animate) app.animTime += dt;
    if (st.curve.animate && !app.placeMode) st.curve.t = (st.curve.t + dt * st.curve.speed) % 1;
  }

  if (!app.scene) app.scene = buildScene();
  const sc = app.scene;
  updateScene(sc, st, app.animTime);
  updateCurveRider();
  updateSweep();
  sc.root.updateWorld();

  // cameras
  const vp = viewports();
  app.views = vp;
  const mainAspect = vp.main ? vp.main[2] / vp.main[3] : vp.inspect[2] / vp.inspect[3];
  const cam = mainCamera(mainAspect);
  app.cams.main = cam;
  app.cams.inspect = vp.inspect ? inspectionCamera(vp.inspect[2] / vp.inspect[3]) : null;

  // overlays
  app.lines.clear(); app.tris.clear();
  buildGridAndAxes();
  buildCurveOverlay();
  const shared = { lines: app.lines.count, tris: app.tris.count };
  if (vp.inspect && st.debug.frustum) safe('frustum', () => buildFrustum(cam));
  // marker for the main camera's eye in the inspection view
  if (vp.inspect) {
    const e = cam.eye, r = 0.08;
    tri([e[0] - r, e[1], e[2]], [e[0] + r, e[1], e[2]], [e[0], e[1] + 2 * r, e[2]], COL.frustum);
    tri([e[0], e[1], e[2] - r], [e[0], e[1], e[2] + r], [e[0], e[1] + 2 * r, e[2]], COL.frustum);
  }
  // clip-space background + border for the inspection inset
  const clipStartT = app.tris.count;
  const zb = 0.9999;
  tri([-1, -1, zb], [1, -1, zb], [1, 1, zb], COL.pipBg); tri([-1, -1, zb], [1, 1, zb], [-1, 1, zb], COL.pipBg);
  const clipStartL = app.lines.count;
  const q = 0.998;
  line([-q, -q, 0], [q, -q, 0], COL.pipBorder); line([q, -q, 0], [q, q, 0], COL.pipBorder);
  line([q, q, 0], [-q, q, 0], COL.pipBorder); line([-q, q, 0], [-q, -q, 0], COL.pipBorder);

  // GPU ribbon (bonus)
  const useGpu = st.curve.gpuRibbon && WGSL_CURVES_IMPLEMENTED && app.curve.mode === 'bezier' && !app.placeMode;
  if (useGpu) app.ribbon.update(app.curve.points.map((p) => paintToWorld(p)), app.curve.segments, 0.018, PAINT.z + 0.01, COL.curve);

  // scene draw list (shared by both views; mvp is filled per view by the renderer)
  const meshDraws = [];
  sc.root.traverse((node) => {
    if (!node.mesh || !node.visible) return;
    meshDraws.push({ kind: 'mesh', mesh: node.mesh, model: node.drawMatrix(), color: node.color, textured: node.textured, unlit: node.unlit });
  });
  const overlay = [
    { kind: 'lines', first: 0, count: shared.lines },
    { kind: 'tris', first: 0, count: shared.tris },
  ];
  if (useGpu) overlay.push({ kind: 'ribbon', buf: app.ribbon.out, count: app.ribbon.vertexCount });

  const views = [];
  if (vp.main) views.push({ viewport: vp.main, VP: cam.VP, draws: [...sceneDraws(meshDraws), ...overlay.map((o) => ({ ...o }))] });
  if (vp.inspect) {
    const ic = app.cams.inspect;
    const draws = [];
    if (vp.main) draws.push({ kind: 'tris', first: clipStartT, count: 6, clip: true });
    draws.push(...sceneDraws(meshDraws), ...overlay.map((o) => ({ ...o })));
    draws.push({ kind: 'lines', first: shared.lines, count: clipStartL - shared.lines });
    draws.push({ kind: 'tris', first: shared.tris, count: clipStartT - shared.tris });
    if (vp.main) draws.push({ kind: 'lines', first: clipStartL, count: 8, clip: true });
    views.push({ viewport: vp.inspect, VP: ic.VP, draws });
  }
  renderer.render(views, { lines: app.lines.view(), tris: app.tris.view() }, useGpu ? (enc) => app.ribbon.encode(enc) : null);
}

// ---------------------------------------------------------------------------
app.reset = () => {
  Object.assign(app.st, freshState());
  app.curve.mode = 'bezier';
  app.curve.reset();
  app.orbit.reset();
  app.animTime = 0;
  app.placeMode = false;
  app.free = { samples: [], fit: null, active: false, error: '' };
  app.panel?.sync();
};

app.goTo = (key) => {
  const vp = VIEWPOINTS[key];
  if (vp.fovDeg) { app.st.fovDeg = vp.fovDeg; app.st.proj = 'persp'; app.panel?.sync(); }
  app.orbit.goTo(vp, app.st.useQuat && app.quatOK);
};

app.exportJSON = () => {
  const json = JSON.stringify(app.curve.toJSON(), null, 2);
  app.lastExport = json;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'curve.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  app.st.info = 'curve';
  app.panel?.sync();
};

app.startPlacing = () => {
  app.placeBackup = app.curve.points.map((p) => [...p]);
  app.curve.points = [];
  app.curve.mode = 'bezier';
  app.st.curve.mode = 'bezier';
  app.placeMode = true;
  app.curve.touch();
  app.panel?.sync();
};

app.finishPlacing = () => {
  const pts = app.curve.points;
  if (pts.length > 0 && pts.length < 10) {
    // the handout asks for at least three segments (3·3 + 1 = 10 points)
    app.placeHint = `need at least 10 points for 3 segments (have ${pts.length})`;
    return;
  }
  app.placeHint = '';
  if (pts.length === 0) {
    app.curve.points = app.placeBackup || app.curve.points;
  } else {
    pts.length = 3 * Math.floor((pts.length - 1) / 3) + 1;
    safe('enforceC1', () => Crv.enforceC1(pts));
  }
  app.placeMode = false;
  app.curve.touch();
  app.panel?.sync();
};

app.fitFreehand = () => {
  const fr = app.free;
  fr.fit = null;
  fr.error = '';
  if (fr.samples.length < 6) { fr.error = 'trace a longer stroke'; return; }
  try {
    fr.fit = Crv.fitCubicBezier(fr.samples);
  } catch (e) {
    fr.error = e instanceof TodoError ? 'implement curves.fitCubicBezier' : e.message;
  }
};

// ---------------------------------------------------------------------------
async function main() {
  const canvas = document.getElementById('gpu');
  try {
    app.renderer = await Renderer.create(canvas);
  } catch (e) {
    const f = document.getElementById('fatal');
    f.style.display = 'grid';
    f.innerHTML = `<div><h2>WebGPU could not start</h2><p>${e.message}</p><p>Use a current Chrome, Edge, Safari 18+ or Firefox 141+.</p></div>`;
    return;
  }
  const r = app.renderer;
  r.device.lost.then((info) => console.error('GPU device lost:', info.message));
  await r.loadPainting(import.meta.env.BASE_URL + 'kavunlu.jpg');
  r.setMesh('quad', Mesh.quad());
  r.setMesh('cube', Mesh.cube());
  r.setMesh('sphere', Mesh.sphere());
  r.setMesh('cone', Mesh.cone());
  r.setMesh('cylinder', Mesh.cylinder());
  r.setMesh('sweep', new Float32Array(0));
  app.ribbon = new GpuRibbon(r.device);

  app.probe = probe();
  app.quatOK = !app.probe.missing.some((f) => f.startsWith('quat.'));
  app.fitOK = !app.probe.missing.includes('curves.fitCubicBezier');
  app.wgslOK = WGSL_CURVES_IMPLEMENTED;

  app.panel = buildPanel(document.getElementById('panel'), app);
  attachInput(canvas, app);
  new ResizeObserver(() => r.resize()).observe(canvas);
  requestAnimationFrame(frame);
}

main();
