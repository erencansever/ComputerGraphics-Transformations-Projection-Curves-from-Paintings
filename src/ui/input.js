// Mouse and keyboard. Left-drag on a control point edits the curve; left-drag
// elsewhere orbits; Shift-drag on the painting records a freehand stroke
// (bonus fit); wheel zooms. Clicks in "place" mode add control points.
import * as Crv from '../math/curves.js';
import { TodoError } from '../math/todo.js';
import { cameraRay, hitPainting, paintToWorld } from './picking.js';

const PICK_RADIUS = 0.09; // world units on the painting plane

export function attachInput(canvas, app) {
  let mode = null; // 'orbit' | 'point' | 'free'
  let last = null;

  const inRect = (r, x, y) => r && x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3];

  /** Painting hit for a pointer event, or null when not over the main view. */
  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width), y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { main, inspect } = app.views || {};
    if (!main || !app.cams.main || (app.st.viewMode === 'pip' && inRect(inspect, x, y)) || !inRect(main, x, y)) return null;
    const ndcX = ((x - main[0]) / main[2]) * 2 - 1, ndcY = 1 - ((y - main[1]) / main[3]) * 2;
    return hitPainting(cameraRay(app.cams.main, ndcX, ndcY));
  }

  function nearestPoint(h) {
    const w = paintToWorld([h.u, h.v]);
    let best = -1, bd = PICK_RADIUS;
    app.curve.points.forEach((p, i) => {
      if (app.curve.mode !== 'bezier' && i % 3) return;
      const q = paintToWorld(p);
      const d = Math.hypot(q[0] - w[0], q[1] - w[1]);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  function c1(moved) {
    try { Crv.enforceC1(app.curve.points, moved); } catch (e) { if (!(e instanceof TodoError)) throw e; }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    last = { x: e.clientX, y: e.clientY };
    const h = pick(e);
    if (app.placeMode) {
      if (h?.inside) { app.curve.points.push([h.u, h.v]); app.curve.touch(); }
      mode = null;
      return;
    }
    if (h && e.shiftKey && h.inside) {
      mode = 'free';
      app.free.samples = [[h.u, h.v]];
      app.free.fit = null;
      return;
    }
    const idx = h ? nearestPoint(h) : -1;
    if (idx >= 0) { mode = 'point'; app.drag.index = idx; app.drag.prev = [h.u, h.v]; return; }
    mode = 'orbit';
    canvas.classList.add('dragging');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!mode) {
      const h = pick(e);
      app.drag.hover = h && !app.placeMode ? nearestPoint(h) : -1;
      canvas.classList.toggle('place', app.placeMode);
      return;
    }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    if (mode === 'orbit') {
      app.orbit.rotate(dx, dy, app.st.unclampPitch);
    } else if (mode === 'point') {
      const h = pick(e);
      if (!h) return;
      const u = Math.min(1, Math.max(0, h.u)), v = Math.min(1, Math.max(0, h.v));
      const pts = app.curve.points, i = app.drag.index;
      const du = u - pts[i][0], dv = v - pts[i][1];
      if (i % 3 === 0) {
        // a knot carries its two handles with it (keeps the joint's tangent)
        for (const j of [i - 1, i + 1]) if (pts[j] && j % 3) { pts[j][0] += du; pts[j][1] += dv; }
      }
      pts[i][0] = u; pts[i][1] = v;
      c1(i);
      app.curve.touch();
    } else if (mode === 'free') {
      const h = pick(e);
      if (!h) return;
      const lastS = app.free.samples[app.free.samples.length - 1];
      if (Math.hypot(h.u - lastS[0], h.v - lastS[1]) > 0.004) app.free.samples.push([h.u, h.v]);
    }
  });

  const end = () => {
    if (mode === 'free') app.fitFreehand();
    mode = null;
    app.drag.index = -1;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(e.deltaY * 0.0012);
    if (app.st.proj === 'ortho') app.st.orthoHeight = Math.min(14, Math.max(1, app.st.orthoHeight * f));
    app.orbit.zoom(f);
    app.panel?.sync();
  }, { passive: false });

  const VIEWS = ['pip', 'split', 'main', 'inspect'];
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    switch (e.key.toLowerCase()) {
      case 'r': app.reset(); break;
      case 'v': app.st.viewMode = VIEWS[(VIEWS.indexOf(app.st.viewMode) + 1) % VIEWS.length]; break;
      case 'p': app.st.proj = app.st.proj === 'persp' ? 'ortho' : 'persp'; break;
      case 'a': app.st.debug.axes = !app.st.debug.axes; break;
      case 'e': app.exportJSON(); break;
      case ' ': app.paused = !app.paused; e.preventDefault(); break;
      default: return;
    }
    app.panel?.sync();
  });
}
