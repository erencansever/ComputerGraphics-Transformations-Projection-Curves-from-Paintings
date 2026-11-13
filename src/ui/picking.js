// Mouse → ray → painting plane. I use the same eye/target/up/fov as the view
// matrix, but build the ray straight from the camera basis, so I don't need a
// general matrix inverse for picking.
import { add, sub, scale, cross, normalize, length } from '../math/vec3.js';
import { PAINT } from '../scene/sceneGraph.js';

/** cam: { eye, target, up, fovY, aspect, ortho, orthoHeight }; ndc ∈ [−1, 1]² */
export function cameraRay(cam, ndcX, ndcY) {
  const f = normalize(sub(cam.target, cam.eye));
  let r = cross(f, cam.up);
  if (length(r) < 1e-6) r = cross(f, Math.abs(f[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
  r = normalize(r);
  const u = cross(r, f);
  if (cam.ortho) {
    const hh = cam.orthoHeight / 2, hw = hh * cam.aspect;
    return { o: add(cam.eye, add(scale(r, ndcX * hw), scale(u, ndcY * hh))), d: f };
  }
  const th = Math.tan(cam.fovY / 2);
  return { o: cam.eye, d: normalize(add(f, add(scale(r, ndcX * th * cam.aspect), scale(u, ndcY * th)))) };
}

/** Intersects with the painting plane z = PAINT.z; returns normalised (u, v). */
export function hitPainting(ray) {
  if (Math.abs(ray.d[2]) < 1e-8) return null;
  const t = (PAINT.z - ray.o[2]) / ray.d[2];
  if (t <= 0) return null;
  const x = ray.o[0] + ray.d[0] * t, y = ray.o[1] + ray.d[1] * t;
  const u = (x - PAINT.cx) / PAINT.W + 0.5, v = (y - PAINT.cy) / PAINT.H + 0.5;
  return { u, v, inside: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
}

/** Normalised painting coordinates → world point on (or just in front of) the painting. */
export function paintToWorld(p, dz = 0) {
  return [PAINT.cx + (p[0] - 0.5) * PAINT.W, PAINT.cy + (p[1] - 0.5) * PAINT.H, PAINT.z + dz];
}
