/**
 * BONUS — curve evaluation on the GPU.
 *
 * These two WGSL functions are pasted into the compute shader in
 * src/render/gpuRibbon.js, which evaluates every sample of the piecewise
 * Bézier in parallel and writes a tessellated ribbon straight into a vertex
 * buffer. Same formulas as bezier / bezierTangent in curves.js.
 */
export const WGSL_CURVES_IMPLEMENTED = true;

export const CURVES_WGSL = /* wgsl */ `
// Cubic Bézier point, t in [0, 1].
fn bezier_point(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let u = 1.0 - t;
  return u * u * u * p0 + 3.0 * u * u * t * p1 + 3.0 * u * t * t * p2 + t * t * t * p3;
}

// Derivative of the cubic Bézier with respect to t.
fn bezier_tangent(p0: vec2f, p1: vec2f, p2: vec2f, p3: vec2f, t: f32) -> vec2f {
  let u = 1.0 - t;
  return 3.0 * u * u * (p1 - p0) + 6.0 * u * t * (p2 - p1) + 3.0 * t * t * (p3 - p2);
}
`;
