// My procedural meshes. Vertex layout (8 floats, 32 bytes):
//   position.xyz, normal.xyz, uv.xy        — non-indexed triangle lists.
// I went with non-indexed lists because it kept the renderer simpler.

function push(out, p, n, uv) {
  out.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]);
}

/** Unit cube centred at the origin. */
export function cube() {
  const out = [];
  const faces = [
    // normal, u axis, v axis
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  for (const [n, u, v] of faces) {
    const c = (a, b) => [0.5 * (n[0] + a * u[0] + b * v[0]), 0.5 * (n[1] + a * u[1] + b * v[1]), 0.5 * (n[2] + a * u[2] + b * v[2])];
    const q = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (const [a, b] of q) push(out, c(a, b), n, [(a + 1) / 2, (1 - b) / 2]);
  }
  return new Float32Array(out);
}

/** Unit quad in the xy-plane facing +z; uv (0,0) is the TOP-left (image rows). */
export function quad() {
  const out = [];
  const n = [0, 0, 1];
  const v = [[-0.5, -0.5, 0, 0, 1], [0.5, -0.5, 0, 1, 1], [0.5, 0.5, 0, 1, 0], [-0.5, -0.5, 0, 0, 1], [0.5, 0.5, 0, 1, 0], [-0.5, 0.5, 0, 0, 0]];
  for (const [x, y, z, s, t] of v) push(out, [x, y, z], n, [s, t]);
  return new Float32Array(out);
}

/** UV sphere of radius 0.5. */
export function sphere(seg = 32, rings = 16) {
  const out = [];
  const P = (i, j) => {
    const th = (i / seg) * Math.PI * 2, ph = (j / rings) * Math.PI;
    const n = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
    return { p: n.map((c) => c * 0.5), n, uv: [i / seg, j / rings] };
  };
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
      for (const v of [a, c, b, a, d, c]) push(out, v.p, v.n, v.uv);
    }
  }
  return new Float32Array(out);
}

/** Cone along +x: base disc at x = −0.5 (radius 0.5), apex at x = +0.5. */
export function cone(seg = 24) {
  const out = [];
  const k = 1 / Math.SQRT2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const r0 = [-0.5, 0.5 * Math.cos(a0), 0.5 * Math.sin(a0)];
    const r1 = [-0.5, 0.5 * Math.cos(a1), 0.5 * Math.sin(a1)];
    const n0 = [k, k * Math.cos(a0), k * Math.sin(a0)], n1 = [k, k * Math.cos(a1), k * Math.sin(a1)];
    const am = (a0 + a1) / 2, nm = [k, k * Math.cos(am), k * Math.sin(am)];
    push(out, r0, n0, [0, 0]); push(out, r1, n1, [1, 0]); push(out, [0.5, 0, 0], nm, [0.5, 1]);
    push(out, [-0.5, 0, 0], [-1, 0, 0], [0.5, 0.5]); push(out, r1, [-1, 0, 0], [1, 0]); push(out, r0, [-1, 0, 0], [0, 0]);
  }
  return new Float32Array(out);
}

/** Cylinder along +y from y = 0 to y = 1, radius 0.5. */
export function cylinder(seg = 24) {
  const out = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b0 = [0.5 * c0, 0, 0.5 * s0], b1 = [0.5 * c1, 0, 0.5 * s1], t0 = [0.5 * c0, 1, 0.5 * s0], t1 = [0.5 * c1, 1, 0.5 * s1];
    const n0 = [c0, 0, s0], n1 = [c1, 0, s1];
    push(out, b0, n0, [0, 0]); push(out, t1, n1, [1, 1]); push(out, b1, n1, [1, 0]);
    push(out, b0, n0, [0, 0]); push(out, t0, n0, [0, 1]); push(out, t1, n1, [1, 1]);
    push(out, [0, 1, 0], [0, 1, 0], [0.5, 0.5]); push(out, t0, [0, 1, 0], [0, 0]); push(out, t1, [0, 1, 0], [1, 0]);
    push(out, [0, 0, 0], [0, -1, 0], [0.5, 0.5]); push(out, b1, [0, -1, 0], [1, 0]); push(out, b0, [0, -1, 0], [0, 0]);
  }
  return new Float32Array(out);
}

/**
 * BONUS — surface of revolution. `profile` is a list of [x, r] pairs (r ≥ 0);
 * every profile point is swept around the x axis. Normals come from the
 * profile's own tangent (finite differences), the shader lights both sides.
 */
export function revolve(profile, seg = 48) {
  const out = [];
  const n = profile.length;
  if (n < 2) return new Float32Array(0);
  const pn = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dr = b[1] - a[1];
    const l = Math.hypot(dx, dr) || 1;
    return [-dr / l, dx / l]; // normal in the (x, radial) half-plane
  });
  const V = (i, j) => {
    const th = (j / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const [x, r] = profile[i], [nx, nr] = pn[i];
    return { p: [x, r * c, r * s], n: [nx, nr * c, nr * s], uv: [i / (n - 1), j / seg] };
  };
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
      for (const v of [a, b, c, a, c, d]) push(out, v.p, v.n, v.uv);
    }
  }
  return new Float32Array(out);
}
