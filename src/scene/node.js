// Part B — scene graph node.
//
// Every node stores only its LOCAL transform (relative to its parent).
// Its WORLD matrix is computed by a depth-first traversal:
//     world(node) = world(parent) · local(node)          (root: world = local)
// `shape` is an extra matrix applied only when drawing this node's own mesh
// (e.g. stretching a unit cube into an arm). It is NOT inherited by children,
// so scaling an arm does not squash the objects it carries.
import { identity, multiply } from '../math/mat4.js';

export class SceneNode {
  constructor(name, { mesh = null, color = [0.8, 0.8, 0.8], shape = null, textured = false, unlit = false } = {}) {
    this.name = name;
    this.mesh = mesh; // key into the renderer's static meshes, or null
    this.color = color;
    this.shape = shape; // Float32Array | null
    this.textured = textured;
    this.unlit = unlit;
    this.visible = true;
    this.local = identity();
    this.world = identity();
    this.parent = null;
    this.children = [];
    this.describe = () => ''; // human-readable local transform for the HUD
  }

  add(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  /** Recomputes world matrices of this subtree. */
  updateWorld(parentWorld = null) {
    this.world = parentWorld ? multiply(parentWorld, this.local) : this.local;
    for (const c of this.children) c.updateWorld(this.world);
  }

  /** Depth-first visit; fn(node, depth). */
  traverse(fn, depth = 0) {
    fn(this, depth);
    for (const c of this.children) c.traverse(fn, depth + 1);
  }

  /** Matrix used to draw this node's mesh. */
  drawMatrix() {
    return this.shape ? multiply(this.world, this.shape) : this.world;
  }

  /** Root-to-node path, e.g. for writing out world = M0 · M1 · … */
  path() {
    const p = [];
    for (let n = this; n; n = n.parent) p.unshift(n);
    return p;
  }
}
