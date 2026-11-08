// The control panel (right side). Every Part of the handout has a section.
import { Controls, el } from './controls.js';
import { VIEWPOINTS } from './orbit.js';

export function buildPanel(root, app) {
  root.innerHTML = '';
  el('h1', { text: 'CS405 · Project 1' }, root);
  el('p', { class: 'sub', html: 'Şeker Ahmed Paşa — <i>Kavunlu Natürmort</i> (Sakıp Sabancı Museum)' }, root);
  const ui = new Controls(root);
  const st = () => app.st;
  const A = () => app.st.partA, B = () => app.st.partB, D = () => app.st.debug, C = () => app.st.curve;

  // ---- E: views -----------------------------------------------------------
  let s = ui.section('View & camera (C, E)');
  ui.select(s, 'view', st, 'viewMode', [['pip', 'Main + inspection inset'], ['split', 'Split: main | inspection'], ['main', 'Main camera only'], ['inspect', 'Inspection camera only']]);
  ui.select(s, 'projection', st, 'proj', [['persp', 'Perspective'], ['ortho', 'Orthographic']]);
  ui.slider(s, 'fov Y (°)', st, 'fovDeg', 10, 110, 1);
  ui.slider(s, 'near', st, 'near', 0.01, 5, 0.01);
  ui.slider(s, 'far', st, 'far', 2, 200, 0.5);
  ui.slider(s, 'ortho height', st, 'orthoHeight', 1, 14, 0.1);
  const q = ui.toggle(s, 'Quaternion orbit + slerp (bonus)', st, 'useQuat');
  if (!app.quatOK) { q.input.disabled = true; q.row.title = 'Implement src/math/quat.js first'; q.row.lastChild.append(el('span', { class: 'warn', text: ' — TODO quat.js' })); }
  ui.note(s, 'Viewpoints (smooth transition):');
  ui.buttons(s, Object.entries(VIEWPOINTS).map(([k, v]) => [v.label, () => app.goTo(k)]));
  ui.toggle(s, 'Allow pitch ±90° (degenerate up test)', st, 'unclampPitch');
  ui.buttons(s, [
    ['Look straight down', () => { app.st.unclampPitch = true; app.orbit.anim = null; app.orbit.q = null; app.orbit.pitch = Math.PI / 2; ui.sync(); }, 'up ∥ view direction: lookAt must not break'],
    ['Reset scene', () => app.reset()],
  ]);
  ui.note(s, '<b>Drag</b> orbit · <b>wheel</b> zoom · <b>drag a point</b> on the painting to edit the curve.');

  // ---- A ------------------------------------------------------------------
  s = ui.section('Part A · Transformations');
  ui.select(s, 'order', A, 'order', [['TRS', 'M = T · R · S'], ['SRT', 'M = S · R · T']]);
  ui.slider(s, 'translate x', A, 'tx', -2.5, 2.5, 0.05);
  ui.slider(s, 'translate y', A, 'ty', -0.5, 3, 0.05);
  ui.slider(s, 'translate z', A, 'tz', -0.5, 3.2, 0.05);
  ui.select(s, 'rotation axis', A, 'axis', [['x', 'x'], ['y', 'y'], ['z', 'z']]);
  ui.slider(s, 'angle (°)', A, 'angle', -180, 180, 1);
  ui.slider(s, 'scale', A, 'scale', 0.1, 2.5, 0.05);
  ui.buttons(s, [['Show both matrices', () => { app.st.info = 'partA'; ui.sync(); }]]);

  // ---- B ------------------------------------------------------------------
  s = ui.section('Part B · Scene graph');
  ui.toggle(s, 'Animate (lamp arm + plate)', B, 'animate');
  ui.slider(s, 'speed', B, 'speed', 0, 3, 0.05);
  ui.slider(s, 'base θ0', B, 'base', -3.14, 3.14, 0.01);
  ui.slider(s, 'joint θ1', B, 'j1', -1.5, 1.5, 0.01);
  ui.slider(s, 'joint θ2', B, 'j2', -2, 2, 0.01);
  ui.buttons(s, [['Show tree + leaf world matrix', () => { app.st.info = 'graph'; ui.sync(); }]]);

  // ---- debug --------------------------------------------------------------
  s = ui.section('Debug drawings (E)');
  ui.toggle(s, 'Node local axes', D, 'axes');
  ui.toggle(s, 'Main-camera frustum (inspection view)', D, 'frustum');
  ui.toggle(s, 'Table grid + world axes', D, 'grid');
  ui.toggle(s, 'Control polygon', D, 'polygon');
  ui.toggle(s, 'de Casteljau construction', D, 'casteljau');
  ui.toggle(s, 'Control points', D, 'points');

  // ---- D ------------------------------------------------------------------
  s = ui.section('Part D · Curves over the painting');
  ui.select(s, 'curve type', C, 'mode', [['bezier', 'Piecewise Bézier (C¹)'], ['catmull', 'Catmull–Rom (through knots)']], () => { app.curve.mode = app.st.curve.mode; app.curve.touch(); });
  const tSlider = ui.slider(s, 'parameter t', C, 't', 0, 1, 0.001, null, (v) => (+v).toFixed(3));
  ui.toggle(s, 'Animate object along curve', C, 'animate');
  ui.slider(s, 'speed', C, 'speed', 0, 0.5, 0.01);
  const placeBtns = ui.buttons(s, [
    ['Place new curve', () => app.startPlacing()],
    ['Finish placing', () => app.finishPlacing()],
    ['Reset curve', () => { app.placeMode = false; app.curve.reset(); }],
    ['Export JSON', () => app.exportJSON()],
  ]);
  ui.note(s, 'Round = knot, square = handle. Dragging a handle mirrors the one across the joint (C¹). Placing: click on the painting, 3n+1 points (10 → 3 segments).');

  // ---- bonus --------------------------------------------------------------
  s = ui.section('Bonus');
  const g = ui.toggle(s, 'GPU ribbon (compute shader)', C, 'gpuRibbon');
  if (!app.wgslOK) { g.input.disabled = true; g.row.lastChild.append(el('span', { class: 'warn', text: ' — TODO curves.wgsl.js' })); }
  ui.toggle(s, 'Surface of revolution of the curve', C, 'sweep');
  ui.toggle(s, 'Show least-squares fit', C, 'showFit');
  ui.note(s, '<b>Shift + drag</b> on the painting traces a freehand stroke; on release a single cubic Bézier is fitted (cyan).' + (app.fitOK ? '' : ' <span class="warn">TODO curves.fitCubicBezier</span>'));
  ui.buttons(s, [['Clear trace', () => { app.free.samples = []; app.free.fit = null; app.free.error = ''; }]]);
  ui.note(s, '“Painting match” viewpoint (View section) lines the camera up with the painted perspective.');

  // ---- info ---------------------------------------------------------------
  s = ui.section('Read-outs');
  ui.select(s, 'matrix panel', st, 'info', [['partA', 'Part A: T·R·S and S·R·T'], ['graph', 'Part B: tree + world matrix'], ['camera', 'Part C: V and P'], ['curve', 'Part D: curve + JSON'], ['off', 'hidden']]);
  ui.note(s, 'Keys: <kbd>R</kbd> reset · <kbd>V</kbd> next view · <kbd>P</kbd> persp/ortho · <kbd>A</kbd> axes · <kbd>Space</kbd> pause · <kbd>E</kbd> export');

  return {
    sync: () => ui.sync(),
    tick: () => {
      tSlider.sync();
      placeBtns[0].classList.toggle('on', app.placeMode);
      placeBtns[1].disabled = !app.placeMode;
    },
  };
}
