// All tweakable application state in one place. "Reset scene" restores this.
export const DEFAULTS = {
  viewMode: 'pip', // 'main' | 'inspect' | 'pip' | 'split'
  proj: 'persp', // 'persp' | 'ortho'
  fovDeg: 45,
  near: 0.1,
  far: 20,
  orthoHeight: 4,
  useQuat: false,
  unclampPitch: false,
  info: 'partA', // which matrix panel is shown
  partA: { order: 'TRS', tx: 0, ty: 0.45, tz: 1.9, axis: 'y', angle: 30, scale: 0.6 },
  partB: { animate: true, speed: 1, base: 0, j1: 0.5, j2: -0.7 },
  debug: { axes: false, frustum: true, grid: true, polygon: true, casteljau: true, points: true },
  curve: { mode: 'bezier', t: 0.35, animate: true, speed: 0.1, gpuRibbon: false, sweep: false, showFit: true },
};

export const freshState = () => structuredClone(DEFAULTS);
