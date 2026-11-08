/**
 * BONUS — curve evaluation on the GPU.               ★ STUDENT CODE ★
 *
 * These two WGSL functions are pasted into the compute shader in
 * src/render/gpuRibbon.js, which evaluates every sample of the piecewise
 * Bézier in parallel and writes a tessellated ribbon straight into a vertex
 * buffer. Implement them, then set WGSL_CURVES_IMPLEMENTED = true to enable
 * the "GPU ribbon (compute)" toggle.
 */
export const WGSL_CURVES_IMPLEMENTED = false;

export const CURVES_WGSL = /* wgsl */ `
// Cubic Bézier point, t in [0, 1].
fn bezier_point(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  // TODO
  return p0;
}

// Derivative of the cubic Bézier with respect to t.
fn bezier_tangent(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  // TODO
  return vec2f(0.0, 0.0);
}
`;
