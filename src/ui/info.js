// The HUD (top-left) and the matrix read-out panel (bottom-left). I use these
// read-outs for the screenshots in my report.
import { fmtMat, fmtV, sideBySide } from './hud.js';
import { transformPoint } from '../math/mat4.js';

export function renderHud(app) {
  const hud = document.getElementById('hud');
  const st = app.st, r = app.renderer, c = app.cams.main;
  const ms = app.frameMs.length ? app.frameMs.reduce((a, b) => a + b, 0) / app.frameMs.length : 0;
  const ai = r.adapterInfo || {};
  const gpu = [ai.vendor, ai.architecture, ai.description].filter(Boolean).join(' · ') || 'unknown GPU';
  const cpu = app.cpuMs.length ? app.cpuMs.reduce((a, b) => a + b, 0) / app.cpuMs.length : 0;
  let s = `frame ${ms.toFixed(2)} ms  (${ms ? (1000 / ms).toFixed(0) : '–'} fps)  cpu ${cpu.toFixed(2)} ms${app.paused ? '  [paused]' : ''}\n`;
  s += `vertices/frame ${r.stats.vertices.toLocaleString()}   draw calls ${r.stats.draws}\n`;
  s += `GPU ${gpu}\n`;
  s += `canvas ${r.canvas.width}×${r.canvas.height}  view: ${st.viewMode}\n`;
  if (c) {
    s += `── main camera (${st.proj === 'persp' ? 'perspective' : 'orthographic'}, ${st.useQuat && app.quatOK ? 'quaternion' : 'euler'} orbit)\n`;
    s += `eye    ${fmtV(c.eye)}\ntarget ${fmtV(c.target)}\nup     ${fmtV(c.up)}\n`;
    s += st.proj === 'persp' ? `fov ${st.fovDeg.toFixed(0)}°  ` : `height ${st.orthoHeight.toFixed(1)}  `;
    s += `near ${st.near.toFixed(2)}  far ${st.far.toFixed(1)}  far/near ${(st.far / st.near).toFixed(0)}\n`;
    const f = [c.target[0] - c.eye[0], c.target[1] - c.eye[1], c.target[2] - c.eye[2]];
    const fl = Math.hypot(...f), dotUp = Math.abs((f[0] * c.up[0] + f[1] * c.up[1] + f[2] * c.up[2]) / (fl * Math.hypot(...c.up)));
    if (dotUp > 0.9999) s += '⚠ up ∥ view direction — lookAt must use a fallback axis\n';
  }
  if (app.placeMode) s += `PLACING: ${app.curve.points.length} points (need 3n+1, ≥10)${app.placeHint ? ' — ' + app.placeHint : ''}\n`;
  s += `colour: ${r.srgbView ? 'sRGB view of the canvas' : 'manual sRGB encode in shader'}\n`;
  if (app.free.error) s += `fit: ${app.free.error}\n`;
  const errs = [...app.errors].filter((e) => !e.startsWith('quat.'));
  if (errs.length) s += `skipped: ${errs.join(', ')}\n`;
  hud.textContent = s.trimEnd();
}

export function renderInfo(app) {
  const box = document.getElementById('mats');
  const st = app.st, sc = app.scene;
  if (st.info === 'off' || !sc) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  let s = '';
  switch (st.info) {
    case 'partA': {
      const a = st.partA;
      s += `Part A — active order: M = ${a.order === 'TRS' ? 'T·R·S' : 'S·R·T'}\n`;
      s += `T = T(${a.tx.toFixed(2)}, ${a.ty.toFixed(2)}, ${a.tz.toFixed(2)})   R = R_${a.axis}(${a.angle}°)   S = S(${a.scale.toFixed(2)})\n\n`;
      s += sideBySide(sc.partA.TRS, sc.partA.SRT, `M = T·R·S${a.order === 'TRS' ? '  ◀ active' : ''}`, `M = S·R·T${a.order === 'SRT' ? '  ◀ active' : ''}`);
      s += `\norigin of the object → TRS ${fmtV(sc.partA.TRS && [sc.partA.TRS[12], sc.partA.TRS[13], sc.partA.TRS[14]])}`;
      s += `   SRT ${fmtV(sc.partA.SRT && [sc.partA.SRT[12], sc.partA.SRT[13], sc.partA.SRT[14]])}`;
      break;
    }
    case 'graph': {
      s += 'Scene graph (local transforms)\n';
      sc.root.traverse((n, d) => {
        if (n.name.startsWith('frame-') && n.name !== 'frame-top') return;
        const label = n.name === 'frame-top' ? 'frame-top … (4 frame nodes)' : n.name;
        s += `${'  '.repeat(d)}${d ? '└ ' : ''}${label}${n.visible ? '' : ' (hidden)'}  ${n.describe()}\n`;
      });
      const leaf = sc.nodes.bulb;
      s += `\nworld(${leaf.name}) = ${leaf.path().slice(1).map((n) => 'M_' + n.name.replace('lamp-', '')).join(' · ')}\n`;
      s += fmtMat(leaf.world);
      s += `bulb centre in world: ${fmtV(transformPoint(leaf.world, [0, 0, 0]), 3)}`;
      break;
    }
    case 'camera': {
      const c = app.cams.main;
      if (!c) break;
      s += sideBySide(c.V, c.P, 'V = lookAt(eye, target, up)', st.proj === 'persp' ? 'P = perspective(fov, aspect, n, f)' : 'P = orthographic(l, r, b, t, n, f)');
      if (app.cams.inspect) s += '\n' + sideBySide(app.cams.inspect.V, app.cams.inspect.P, 'V_inspect', 'P_inspect');
      break;
    }
    case 'curve': {
      const cv = app.curve;
      s += `${cv.mode === 'bezier' ? 'piecewise cubic Bézier' : 'Catmull–Rom'} · ${cv.segments} segments · ${cv.points.length} control points\n`;
      s += `t = ${st.curve.t.toFixed(3)}\n`;
      try {
        const e = cv.evalAt(st.curve.t);
        s += `C(t)  = ${fmtV(e.p, 4)}   C'(t) = ${fmtV(e.d, 3)}\n`;
      } catch { s += 'C(t)  = (curve functions TODO)\n'; }
      s += `C¹ residual at joints: ${cv.c1Residuals().map((x) => x.toExponential(1)).join(', ') || '—'}\n`;
      if (app.lastExport) s += `\nlast export (curve.json):\n${app.lastExport.split('\n').slice(0, 22).join('\n')}\n…`;
      else s += '\nPress “Export JSON” (or E) to download curve.json.';
      break;
    }
  }
  box.textContent = s;
}
