// BONUS — evaluate the curve in a compute shader and draw it as a ribbon.
//
// One invocation per curve sample: it evaluates the Bézier point and tangent
// (student WGSL from src/math/curves.wgsl.js), offsets ±halfWidth along the
// in-plane normal and writes two vertices into a buffer that is ALSO bound as
// a vertex buffer, so the ribbon is drawn as one triangle strip without the
// CPU ever seeing the samples.
import { CURVES_WGSL } from '../math/curves.wgsl.js';

const MAX_CTRL = 256;
const SPP = 64; // samples per segment

const COMPUTE_WGSL = /* wgsl */ `
${CURVES_WGSL}

struct Params { nSeg: u32, spp: u32, halfWidth: f32, z: f32, color: vec4f };
struct Vtx { pos: vec4f, col: vec4f };

@group(0) @binding(0) var<storage, read> ctrl: array<vec4f>;
@group(0) @binding(1) var<uniform> P: Params;
@group(0) @binding(2) var<storage, read_write> outv: array<Vtx>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let total = P.nSeg * P.spp + 1u;
  let i = id.x;
  if (i >= total) { return; }
  var seg = i / P.spp;
  var t = f32(i % P.spp) / f32(P.spp);
  if (seg >= P.nSeg) { seg = P.nSeg - 1u; t = 1.0; }
  let b = seg * 3u;
  let p0 = ctrl[b].xy; let p1 = ctrl[b + 1u].xy; let p2 = ctrl[b + 2u].xy; let p3 = ctrl[b + 3u].xy;
  let p = bezier_point(p0, p1, p2, p3, t);
  var d = bezier_tangent(p0, p1, p2, p3, t);
  if (length(d) < 1e-6) { d = vec2f(1.0, 0.0); }
  d = normalize(d);
  let n = vec2f(-d.y, d.x) * P.halfWidth;
  outv[2u * i]      = Vtx(vec4f(p + n, P.z, 1.0), P.color);
  outv[2u * i + 1u] = Vtx(vec4f(p - n, P.z, 1.0), P.color);
}
`;

export class GpuRibbon {
  constructor(device) {
    this.device = device;
    this.ctrl = device.createBuffer({ size: MAX_CTRL * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.params = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const maxVerts = 2 * (Math.floor((MAX_CTRL - 1) / 3) * SPP + 1);
    this.out = device.createBuffer({ size: maxVerts * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX });
    this.pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: COMPUTE_WGSL }), entryPoint: 'main' } });
    this.bg = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.ctrl } },
        { binding: 1, resource: { buffer: this.params } },
        { binding: 2, resource: { buffer: this.out } },
      ],
    });
    this.vertexCount = 0;
  }

  /** worldPts: control points already mapped onto the painting plane (x, y). */
  update(worldPts, nSeg, halfWidth, z, color) {
    const n = Math.min(worldPts.length, MAX_CTRL);
    nSeg = Math.min(nSeg, Math.floor((n - 1) / 3));
    if (nSeg < 1) { this.vertexCount = 0; return; }
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) data.set([worldPts[i][0], worldPts[i][1], 0, 0], i * 4);
    this.device.queue.writeBuffer(this.ctrl, 0, data);
    const p = new ArrayBuffer(32), u = new Uint32Array(p), f = new Float32Array(p);
    u[0] = nSeg; u[1] = SPP; f[2] = halfWidth; f[3] = z; f.set([color[0], color[1], color[2], 1], 4);
    this.device.queue.writeBuffer(this.params, 0, p);
    this.total = nSeg * SPP + 1;
    this.vertexCount = 2 * this.total;
  }

  encode(enc) {
    if (!this.vertexCount) return;
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bg);
    pass.dispatchWorkgroups(Math.ceil(this.total / 64));
    pass.end();
  }
}
