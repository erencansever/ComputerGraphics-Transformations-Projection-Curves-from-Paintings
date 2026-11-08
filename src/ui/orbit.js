// Mouse orbit camera around a target, with two parametrisations:
//   • Euler (yaw, pitch) — eye on a sphere, up = world +y. Pitch is clamped
//     unless "allow ±90°" is on, which lets you hit the lookAt degenerate case.
//   • Quaternion (bonus) — orientation q = R_y(yaw) ⊗ R_x(−pitch);
//     eye = target + q·(0,0,dist), up = q·(0,1,0). Moving between viewpoints
//     uses slerp, so the camera turns along the shortest great-circle arc.
import * as Q from '../math/quat.js';
import { add, scale } from '../math/vec3.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (t) => t * t * (3 - 2 * t);

export const VIEWPOINTS = {
  front: { label: 'Front', yaw: 0, pitch: 0.12, dist: 7.5, target: [0, 1.3, 0.8] },
  // Eye roughly at the painter's eye level, slightly above the table, centred
  // on the painting: the vanishing direction of the painted table top and the
  // 3D table line up (tune and justify in the report).
  painting: { label: 'Painting match', yaw: 0, pitch: 0.06, dist: 5.4, target: [0, 1.45, 0], fovDeg: 34 },
  left: { label: 'Left', yaw: -1.0, pitch: 0.35, dist: 7, target: [0, 1.0, 0.9] },
  top: { label: 'Top', yaw: 0.0, pitch: 1.45, dist: 8, target: [0, 0.4, 1.3] },
};

export class Orbit {
  constructor() {
    this.reset();
  }

  reset() {
    this.yaw = 0.42;
    this.pitch = 0.24;
    this.dist = 8.2;
    this.target = [0, 1.15, 0.9];
    this.q = null; // set while a quaternion transition is running
    this.anim = null;
  }

  qFromAngles(yaw = this.yaw, pitch = this.pitch) {
    return Q.multiply(Q.fromAxisAngle([0, 1, 0], yaw), Q.fromAxisAngle([1, 0, 0], -pitch));
  }

  /** @returns {{eye:number[], up:number[]}} */
  eyeUp(useQuat) {
    if (useQuat) {
      const q = this.q || this.qFromAngles();
      return { eye: add(this.target, Q.rotateVec3(q, [0, 0, this.dist])), up: Q.rotateVec3(q, [0, 1, 0]) };
    }
    const cp = Math.cos(this.pitch);
    const dir = [cp * Math.sin(this.yaw), Math.sin(this.pitch), cp * Math.cos(this.yaw)];
    return { eye: add(this.target, scale(dir, this.dist)), up: [0, 1, 0] };
  }

  rotate(dx, dy, unclamp) {
    this.anim = null;
    this.q = null;
    this.yaw -= dx * 0.008;
    const lim = unclamp ? Math.PI / 2 : 1.5;
    this.pitch = clamp(this.pitch + dy * 0.008, -lim, lim);
  }

  zoom(f) {
    this.dist = clamp(this.dist * f, 1.2, 60);
  }

  /** Smoothly moves to a viewpoint (slerp in quaternion mode). */
  goTo(vp, useQuat, duration = 1.1) {
    this.anim = {
      t: 0, duration, useQuat, vp,
      from: { yaw: this.yaw, pitch: this.pitch, dist: this.dist, target: [...this.target] },
      qa: useQuat ? this.q || this.qFromAngles() : null,
      qb: useQuat ? this.qFromAngles(vp.yaw, vp.pitch) : null,
    };
  }

  update(dt) {
    const a = this.anim;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / a.duration);
    const s = smooth(a.t);
    this.dist = a.from.dist + (a.vp.dist - a.from.dist) * s;
    this.target = a.from.target.map((x, i) => x + (a.vp.target[i] - x) * s);
    if (a.useQuat) {
      this.q = Q.slerp(a.qa, a.qb, s);
    } else {
      let dy = a.vp.yaw - a.from.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy)); // shortest way round
      this.yaw = a.from.yaw + dy * s;
      this.pitch = a.from.pitch + (a.vp.pitch - a.from.pitch) * s;
    }
    if (a.t >= 1) {
      this.yaw = a.vp.yaw;
      this.pitch = a.vp.pitch;
      this.q = null;
      this.anim = null;
    }
  }
}
