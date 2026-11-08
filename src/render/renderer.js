// WebGPU renderer: device setup, pipelines, buffers and the per-frame encode.
//
// Each frame the app hands over a list of VIEWS. A view is a viewport plus a
// view-projection matrix and a list of DRAWS. Every draw gets its own slot in
// one uniform buffer (mvp, model, colour, flags) addressed by a dynamic
// offset, so the whole frame needs a single writeBuffer for its uniforms.
// Views are encoded as separate render passes so each gets its own depth
// clear (that is what makes the picture-in-picture inspection view work).
import { MESH_WGSL, COLOR_WGSL, RIBBON_WGSL } from './shaders.js';
import { multiply, identity } from '../math/mat4.js';

const SLOT = 256; // minUniformBufferOffsetAlignment
const SLOT_FLOATS = SLOT / 4;
const MAX_DRAWS = 2048;
const MESH_STRIDE = 32; // pos3 normal3 uv2
const COLOR_STRIDE = 24; // pos3 colour3

export class Renderer {
  static async create(canvas) {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    const device = await adapter.requestDevice();
    return new Renderer(canvas, adapter, device);
  }

  constructor(canvas, adapter, device) {
    this.canvas = canvas;
    this.device = device;
    this.adapterInfo = adapter.info || {};
    this.ctx = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    // Render into an sRGB *view* of the swap-chain texture: shaders output
    // linear colour and the hardware encodes it, matching the srgb texture.
    this.viewFormat = this.format + '-srgb';
    this.ctx.configure({ device, format: this.format, viewFormats: [this.viewFormat], alphaMode: 'opaque' });
    this.meshes = {}; // name → { buf, count }
    this.stats = { vertices: 0, draws: 0 };
    this.staging = new Float32Array(MAX_DRAWS * SLOT_FLOATS);
    this.ubuf = device.createBuffer({ size: MAX_DRAWS * SLOT, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.dyn = {
      lines: this.#dynBuffer(400_000),
      tris: this.#dynBuffer(600_000),
    };
    this.#createPipelines();
    this.#createWhiteTexture();
    this.resize();
  }

  #dynBuffer(floats) {
    return { buf: this.device.createBuffer({ size: floats * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }), cap: floats };
  }

  #createPipelines() {
    const d = this.device;
    const uniformEntry = { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 160 } };
    this.meshLayout = d.createBindGroupLayout({
      entries: [
        uniformEntry,
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });
    this.colorLayout = d.createBindGroupLayout({ entries: [uniformEntry] });
    this.colorBG = d.createBindGroup({ layout: this.colorLayout, entries: [{ binding: 0, resource: { buffer: this.ubuf, size: 160 } }] });
    this.sampler = d.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

    const target = [{ format: this.viewFormat }];
    const depth = (cmp, write = true) => ({ format: 'depth24plus', depthWriteEnabled: write, depthCompare: cmp });
    const meshModule = d.createShaderModule({ code: MESH_WGSL });
    const colorModule = d.createShaderModule({ code: COLOR_WGSL });
    const ribbonModule = d.createShaderModule({ code: RIBBON_WGSL });
    const meshPL = d.createPipelineLayout({ bindGroupLayouts: [this.meshLayout] });
    const colorPL = d.createPipelineLayout({ bindGroupLayouts: [this.colorLayout] });

    this.pipelines = {
      mesh: d.createRenderPipeline({
        layout: meshPL,
        vertex: {
          module: meshModule, entryPoint: 'vs',
          buffers: [{ arrayStride: MESH_STRIDE, attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x2' },
          ] }],
        },
        fragment: { module: meshModule, entryPoint: 'fs', targets: target },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: depth('less'),
      }),
    };
    const colorBuffers = [{ arrayStride: COLOR_STRIDE, attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x3' },
      { shaderLocation: 1, offset: 12, format: 'float32x3' },
    ] }];
    for (const [name, topology] of [['lines', 'line-list'], ['tris', 'triangle-list']]) {
      this.pipelines[name] = d.createRenderPipeline({
        layout: colorPL,
        vertex: { module: colorModule, entryPoint: 'vs', buffers: colorBuffers },
        fragment: { module: colorModule, entryPoint: 'fs', targets: target },
        primitive: { topology, cullMode: 'none' },
        depthStencil: depth('less-equal'),
      });
    }
    this.pipelines.ribbon = d.createRenderPipeline({
      layout: colorPL,
      vertex: { module: ribbonModule, entryPoint: 'vs', buffers: [{ arrayStride: 32, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x4' },
        { shaderLocation: 1, offset: 16, format: 'float32x4' },
      ] }] },
      fragment: { module: ribbonModule, entryPoint: 'fs', targets: target },
      primitive: { topology: 'triangle-strip', cullMode: 'none' },
      depthStencil: depth('less-equal'),
    });
  }

  #createWhiteTexture() {
    const t = this.device.createTexture({ size: [1, 1], format: 'rgba8unorm-srgb', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.device.queue.writeTexture({ texture: t }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
    this.whiteBG = this.#meshBindGroup(t);
    this.paintingBG = this.whiteBG;
  }

  #meshBindGroup(texture) {
    return this.device.createBindGroup({
      layout: this.meshLayout,
      entries: [
        { binding: 0, resource: { buffer: this.ubuf, size: 160 } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: texture.createView() },
      ],
    });
  }

  /** Loads the painting as an sRGB texture (decoded without colour-space conversion). */
  async loadPainting(url) {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    const tex = this.device.createTexture({
      size: [bmp.width, bmp.height],
      format: 'rgba8unorm-srgb',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [bmp.width, bmp.height]);
    this.paintingBG = this.#meshBindGroup(tex);
    return { width: bmp.width, height: bmp.height };
  }

  /** Uploads (or replaces) a static mesh. */
  setMesh(name, data) {
    const old = this.meshes[name];
    if (old && old.buf.size >= data.byteLength && data.byteLength > 0) {
      this.device.queue.writeBuffer(old.buf, 0, data);
      old.count = data.length / 8;
      return;
    }
    old?.buf.destroy();
    const buf = this.device.createBuffer({ size: Math.max(32, data.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    if (data.byteLength) this.device.queue.writeBuffer(buf, 0, data);
    this.meshes[name] = { buf, count: data.length / 8 };
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (w === this.canvas.width && h === this.canvas.height && this.depth) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.depth?.destroy();
    this.depth = this.device.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    this.depthView = this.depth.createView();
  }

  /**
   * Draws one frame.
   * @param views    [{ viewport:[x,y,w,h] (device px), VP, draws:[...] }]
   * @param dynamic  { lines: Float32Array, tris: Float32Array } world-space overlay geometry
   * @param compute  optional (encoder) => void, recorded before the render passes
   *
   * A draw is { kind: 'mesh'|'lines'|'tris'|'ribbon', mesh?, buf?, first?, count?,
   *             model?, color?, textured?, unlit?, clip? }.
   * `clip: true` means the vertices are already in clip space (mvp = I).
   */
  render(views, dynamic, compute) {
    const d = this.device;
    for (const k of ['lines', 'tris']) {
      const data = dynamic[k];
      const n = Math.min(data.length, this.dyn[k].cap);
      if (n) d.queue.writeBuffer(this.dyn[k].buf, 0, data, 0, n);
    }

    // 1) fill every draw's uniform slot
    const I = identity();
    let slot = 0;
    const st = this.staging;
    for (const view of views) {
      for (const dr of view.draws) {
        if (slot >= MAX_DRAWS) { dr.skip = true; continue; }
        const model = dr.model || I;
        const mvp = dr.clip ? I : multiply(view.VP, model);
        const o = slot * SLOT_FLOATS;
        st.set(mvp, o);
        st.set(model, o + 16);
        const c = dr.color || [1, 1, 1];
        st[o + 32] = c[0]; st[o + 33] = c[1]; st[o + 34] = c[2]; st[o + 35] = 1;
        st[o + 36] = dr.textured ? 1 : 0; st[o + 37] = dr.unlit ? 1 : 0; st[o + 38] = 0; st[o + 39] = 0;
        dr.slot = slot++;
      }
    }
    if (slot) d.queue.writeBuffer(this.ubuf, 0, st, 0, slot * SLOT_FLOATS);

    // 2) encode
    const enc = d.createCommandEncoder();
    compute?.(enc);
    const colorView = this.ctx.getCurrentTexture().createView({ format: this.viewFormat });
    let vertices = 0, draws = 0;
    views.forEach((view, vi) => {
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: colorView, loadOp: vi === 0 ? 'clear' : 'load', storeOp: 'store', clearValue: { r: 0.018, g: 0.017, b: 0.016, a: 1 } }],
        depthStencilAttachment: { view: this.depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
      });
      const [x, y, w, h] = view.viewport.map(Math.round);
      const cx = Math.max(0, Math.min(x, this.canvas.width - 1)), cy = Math.max(0, Math.min(y, this.canvas.height - 1));
      const cw = Math.max(1, Math.min(w, this.canvas.width - cx)), ch = Math.max(1, Math.min(h, this.canvas.height - cy));
      pass.setViewport(cx, cy, cw, ch, 0, 1);
      pass.setScissorRect(cx, cy, cw, ch);
      for (const dr of view.draws) {
        if (dr.skip) continue;
        let buf, first = dr.first || 0, count = dr.count;
        switch (dr.kind) {
          case 'mesh': {
            const m = this.meshes[dr.mesh];
            if (!m || !m.count) continue;
            pass.setPipeline(this.pipelines.mesh);
            pass.setBindGroup(0, dr.textured ? this.paintingBG : this.whiteBG, [dr.slot * SLOT]);
            buf = m.buf; first = 0; count = m.count;
            break;
          }
          case 'lines':
          case 'tris':
            pass.setPipeline(this.pipelines[dr.kind]);
            pass.setBindGroup(0, this.colorBG, [dr.slot * SLOT]);
            buf = dr.buf || this.dyn[dr.kind].buf;
            break;
          case 'ribbon':
            pass.setPipeline(this.pipelines.ribbon);
            pass.setBindGroup(0, this.colorBG, [dr.slot * SLOT]);
            buf = dr.buf;
            break;
        }
        if (!count) continue;
        pass.setVertexBuffer(0, buf);
        pass.draw(count, 1, first, 0);
        vertices += count;
        draws++;
      }
      pass.end();
    });
    d.queue.submit([enc.finish()]);
    this.stats.vertices = vertices;
    this.stats.draws = draws;
  }
}

/** Growable float list for building dynamic geometry each frame. */
export class FloatList {
  constructor(n = 4096) { this.a = new Float32Array(n); this.n = 0; }
  clear() { this.n = 0; }
  #grow(k) { if (this.n + k <= this.a.length) return; const b = new Float32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; }
  /** colour vertex: position + colour */
  v(p, c) { this.#grow(6); const a = this.a, n = this.n; a[n] = p[0]; a[n + 1] = p[1]; a[n + 2] = p[2]; a[n + 3] = c[0]; a[n + 4] = c[1]; a[n + 5] = c[2]; this.n += 6; }
  get count() { return this.n / 6; }
  view() { return this.a.subarray(0, this.n); }
}
