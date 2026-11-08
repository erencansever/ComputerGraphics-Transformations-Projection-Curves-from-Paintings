// WGSL shaders. Every draw has its own 256-byte slot in one uniform buffer,
// selected with a dynamic offset:
//   mvp    = P · V · M   (computed on the CPU with the student's mat4 code)
//   model  = M           (normals; the scene only uses uniform scales on lit
//                         objects that matter, so the upper 3×3 is good enough)
//   color  = base colour (linear)
//   params = (useTexture, unlit, 0, 0)
const UNIFORMS = /* wgsl */ `
struct U {
  mvp: mat4x4f,
  model: mat4x4f,
  color: vec4f,
  params: vec4f,
};
@group(0) @binding(0) var<uniform> u: U;
`;

export const MESH_WGSL = /* wgsl */ `
${UNIFORMS}
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) n: vec3f,
  @location(1) uv: vec2f,
};

@vertex fn vs(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f) -> VSOut {
  var o: VSOut;
  o.pos = u.mvp * vec4f(p, 1.0);
  o.n = (u.model * vec4f(n, 0.0)).xyz;
  o.uv = uv;
  return o;
}

@fragment fn fs(i: VSOut) -> @location(0) vec4f {
  // The texture is rgba8unorm-srgb, so this sample is already linear.
  let t = textureSample(tex, samp, i.uv).rgb;
  let base = select(u.color.rgb, t, u.params.x > 0.5);
  let L = normalize(vec3f(0.35, 0.85, 0.55));
  let d = abs(dot(normalize(i.n), L));           // two-sided
  let lit = base * (0.28 + 0.72 * d);
  return vec4f(select(lit, base, u.params.y > 0.5), 1.0);
}
`;

// Lines and overlay triangles: world-space position + per-vertex colour.
export const COLOR_WGSL = /* wgsl */ `
${UNIFORMS}
struct VSOut { @builtin(position) pos: vec4f, @location(0) c: vec3f };

@vertex fn vs(@location(0) p: vec3f, @location(1) c: vec3f) -> VSOut {
  var o: VSOut;
  o.pos = u.mvp * vec4f(p, 1.0);
  o.c = c;
  return o;
}

@fragment fn fs(i: VSOut) -> @location(0) vec4f { return vec4f(i.c, 1.0); }
`;

// Ribbon written by the compute shader: vec4 position + vec4 colour.
export const RIBBON_WGSL = /* wgsl */ `
${UNIFORMS}
struct VSOut { @builtin(position) pos: vec4f, @location(0) c: vec3f };

@vertex fn vs(@location(0) p: vec4f, @location(1) c: vec4f) -> VSOut {
  var o: VSOut;
  o.pos = u.mvp * vec4f(p.xyz, 1.0);
  o.c = c.rgb;
  return o;
}

@fragment fn fs(i: VSOut) -> @location(0) vec4f { return vec4f(i.c, 1.0); }
`;
