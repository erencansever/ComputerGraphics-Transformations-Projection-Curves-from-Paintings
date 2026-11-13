// Builds my scene in front of the painting and animates it. The tree:
//
//  root
//  ├─ painting            T(0, 1.6, 0)              (textured quad, shape = S(W, H, 1))
//  │  ├─ frame-top / frame-bottom / frame-left / frame-right
//  ├─ partA-object        T·R·S or S·R·T from the UI (Part A)
//  ├─ table               T(0, −0.05, 1.6)
//  │  ├─ lamp-base        T(−1.7, 0.05, −0.7) · R_y(θ0(t))        ← animated
//  │  │  └─ lamp-arm1     T(0, 0.05, 0) · R_z(θ1(t))              ← animated
//  │  │     └─ lamp-arm2  T(0, 1.0, 0) · R_z(θ2(t))               ← animated
//  │  │        └─ lamp-head  T(0, 0.8, 0) · R_z(−2.0)
//  │  │           └─ lamp-bulb  T(0.12, 0, 0)
//  │  ├─ plate            T(1.6, 0.05, −0.6) · R_y(0.5 t)         ← animated
//  │  │  ├─ apple         T(0.22, 0.17, 0.05)
//  │  │  └─ pear          T(−0.2, 0.02, −0.1) · R_z(π/2)
//  │  └─ sweep            T(0.85, y, −0.95)·S(k): surface of revolution of the traced curve (bonus)
//  └─ curve-rider         rides the curve on the painting, oriented by the tangent
import { SceneNode } from './node.js';
import * as M from '../math/mat4.js';
import { srgb } from '../render/color.js';

const IMG_W = 720, IMG_H = 502;
export const PAINT = { cx: 0, cy: 1.6, z: 0, W: 4, H: (4 * IMG_H) / IMG_W };

const f2 = (x) => x.toFixed(2);

export function buildScene() {
  const { translate: T, scale: S, rotateZ: Rz } = M;
  const root = new SceneNode('root');

  const painting = root.add(new SceneNode('painting', { mesh: 'quad', textured: true, unlit: true, shape: S(PAINT.W, PAINT.H, 1) }));
  painting.local = T(PAINT.cx, PAINT.cy, PAINT.z);
  painting.describe = () => `T(0, ${PAINT.cy}, 0)`;

  const fw = 0.14, fd = 0.08, frameCol = srgb('#7a5626');
  const frame = [
    ['frame-top', [0, PAINT.H / 2 + fw / 2, 0], [PAINT.W + 2 * fw, fw, fd]],
    ['frame-bottom', [0, -PAINT.H / 2 - fw / 2, 0], [PAINT.W + 2 * fw, fw, fd]],
    ['frame-left', [-PAINT.W / 2 - fw / 2, 0, 0], [fw, PAINT.H, fd]],
    ['frame-right', [PAINT.W / 2 + fw / 2, 0, 0], [fw, PAINT.H, fd]],
  ];
  for (const [name, t, s] of frame) {
    const n = painting.add(new SceneNode(name, { mesh: 'cube', color: frameCol, shape: S(...s) }));
    n.local = T(...t);
    n.describe = () => `T(${t.map(f2).join(', ')})`;
  }

  const partA = root.add(new SceneNode('partA-object', { mesh: 'cube', color: srgb('#c8642a') }));

  const table = root.add(new SceneNode('table', { mesh: 'cube', color: srgb('#9aa29a'), shape: S(5.6, 0.1, 3.2) }));
  table.local = T(0, -0.05, 1.6);
  table.describe = () => 'T(0, −0.05, 1.6)';

  const metal = srgb('#2f4f6f');
  const lampBase = table.add(new SceneNode('lamp-base', { mesh: 'cylinder', color: metal, shape: S(0.6, 0.06, 0.6) }));
  const arm1 = lampBase.add(new SceneNode('lamp-arm1', { mesh: 'cube', color: srgb('#3f6f9f'), shape: M.multiply(T(0, 0.5, 0), S(0.08, 1.0, 0.08)) }));
  const arm2 = arm1.add(new SceneNode('lamp-arm2', { mesh: 'cube', color: srgb('#b4441c'), shape: M.multiply(T(0, 0.4, 0), S(0.07, 0.8, 0.07)) }));
  const head = arm2.add(new SceneNode('lamp-head', { mesh: 'cone', color: srgb('#c9a227'), shape: M.multiply(M.rotateZ(Math.PI), S(0.34, 0.3, 0.3)) }));
  const bulb = head.add(new SceneNode('lamp-bulb', { mesh: 'sphere', color: srgb('#fff2b0'), unlit: true, shape: S(0.12, 0.12, 0.12) }));

  const plate = table.add(new SceneNode('plate', { mesh: 'cylinder', color: srgb('#e8e2d0'), shape: S(0.9, 0.03, 0.9) }));
  const apple = plate.add(new SceneNode('apple', { mesh: 'sphere', color: srgb('#a8322a'), shape: S(0.28, 0.26, 0.28) }));
  const pear = plate.add(new SceneNode('pear', { mesh: 'cone', color: srgb('#b9b443'), shape: S(0.3, 0.24, 0.24) }));

  const sweep = table.add(new SceneNode('sweep', { mesh: 'sweep', color: srgb('#c9b14a') }));
  sweep.visible = false;

  const rider = root.add(new SceneNode('curve-rider', { mesh: 'cone', color: srgb('#ffd54a'), unlit: false, shape: S(0.22, 0.12, 0.05) }));

  const nodes = { painting, partA, table, lampBase, arm1, arm2, head, bulb, plate, apple, pear, sweep, rider };
  return { root, nodes, partA: { TRS: null, SRT: null }, Rz };
}

/** Writes this frame's local matrices. `time` in seconds of animation time. */
export function updateScene(sc, st, time) {
  const { translate: T, rotateX: Rx, rotateY: Ry, rotateZ: Rz, scale: S, multiply: mul } = M;
  const n = sc.nodes;

  // ---- Part A: the user-controlled object --------------------------------
  const a = st.partA;
  const ang = (a.angle * Math.PI) / 180;
  const Tm = T(a.tx, a.ty, a.tz);
  const Rm = a.axis === 'x' ? Rx(ang) : a.axis === 'z' ? Rz(ang) : Ry(ang);
  const Sm = S(a.scale, a.scale, a.scale);
  sc.partA.TRS = mul(Tm, mul(Rm, Sm));
  sc.partA.SRT = mul(Sm, mul(Rm, Tm));
  n.partA.local = a.order === 'TRS' ? sc.partA.TRS : sc.partA.SRT;
  n.partA.describe = () => (a.order === 'TRS' ? 'T·R·S' : 'S·R·T') + ` (t=(${f2(a.tx)}, ${f2(a.ty)}, ${f2(a.tz)}), R_${a.axis}(${a.angle}°), s=${f2(a.scale)})`;

  // ---- Part B: animated hierarchy ----------------------------------------
  const b = st.partB;
  const k = b.animate ? time * b.speed : 0;
  const th0 = b.base + 0.45 * k;
  const th1 = b.j1 + (b.animate ? 0.35 * Math.sin(1.3 * k) : 0);
  const th2 = b.j2 + (b.animate ? 0.5 * Math.sin(0.9 * k + 1) : 0);
  n.lampBase.local = mul(T(-1.7, 0.05, -0.7), Ry(th0));
  n.lampBase.describe = () => `T(−1.7, 0.05, −0.7)·R_y(${f2(th0)})`;
  n.arm1.local = mul(T(0, 0.05, 0), Rz(th1));
  n.arm1.describe = () => `T(0, 0.05, 0)·R_z(${f2(th1)})`;
  n.arm2.local = mul(T(0, 1.0, 0), Rz(th2));
  n.arm2.describe = () => `T(0, 1.0, 0)·R_z(${f2(th2)})`;
  n.head.local = mul(T(0, 0.8, 0), Rz(-2.0));
  n.head.describe = () => 'T(0, 0.8, 0)·R_z(−2.00)';
  n.bulb.local = T(0.12, 0, 0);
  n.bulb.describe = () => 'T(0.12, 0, 0)';

  const thp = 0.5 * k;
  n.plate.local = mul(T(1.6, 0.05, -0.6), Ry(thp));
  n.plate.describe = () => `T(1.6, 0.05, −0.6)·R_y(${f2(thp)})`;
  n.apple.local = T(0.22, 0.15, 0.05);
  n.apple.describe = () => 'T(0.22, 0.15, 0.05)';
  n.pear.local = mul(T(-0.2, 0.14, -0.1), Rz(Math.PI / 2));
  n.pear.describe = () => 'T(−0.2, 0.14, −0.1)·R_z(π/2)';
}
