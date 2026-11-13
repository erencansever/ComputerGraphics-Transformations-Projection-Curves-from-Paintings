# CS405 Project 1 — Transformations, Projection & Curves from Paintings

One WebGPU application that turns **Şeker Ahmed Paşa — *Kavunlu Natürmort*** (Sakıp Sabancı Museum) into a small 3D scene. The painting hangs as a textured quad, objects stand on a table in front of it, an orbit camera moves around them, and a C¹ piecewise curve is traced over the melon.

```
p_clip = P · V · M · p_object
```

## Run

```bash
npm install
npm run dev        # open the printed http://localhost:5173
npm test           # unit tests for the maths (node --test, no extra packages)
```

You need a browser with WebGPU: current Chrome or Edge, Safari 18+, or Firefox 141+. No libraries are used at run time (no Three.js, no gl-matrix). Vite is the only dev dependency.

## The maths

All matrix, camera and curve code is written from scratch in `src/math/`. `npm test` runs 24 unit tests and all of them pass.

| File | Functions | Part |
|---|---|---|
| `src/math/mat4.js` | identity, multiply, translate, rotateX/Y/Z, scale, transpose, invertRigid (`[Rᵀ \| −Rᵀt]`), transformPoint | A |
| `src/math/camera.js` | lookAt (two cross products, with a fallback axis when up ∥ view direction), perspective and orthographic with z ∈ [0, 1] | C |
| `src/math/curves.js` | bezier (Bernstein form), bezierTangent, deCasteljau, enforceC1 (`P_after = 2K − P_before`), catmullRom, catmullRomTangent | D |
| `src/math/curves.js` | fitCubicBezier: chord-length parametrisation + 2×2 least-squares normal equations | bonus |
| `src/math/quat.js` | fromAxisAngle, multiply, normalize, slerp (shortest arc), rotateVec3 | bonus |
| `src/math/curves.wgsl.js` | `bezier_point`, `bezier_tangent` in WGSL for the compute-shader ribbon | bonus |

## Controls

**Mouse (main view)**

| Action | Effect |
|---|---|
| drag on empty space | orbit the main camera around its target |
| wheel | zoom (in orthographic mode it also changes the view height) |
| drag a **round** point | move a knot (its two handles move with it) |
| drag a **square** point | move a handle; the handle across the joint is mirrored (C¹) |
| **Shift** + drag on the painting | freehand stroke, fitted with one cubic Bézier on release (bonus) |
| click (in *Place new curve* mode) | add a control point on the painting |

**Keyboard:** `R` reset scene · `V` next view layout · `P` perspective/orthographic · `A` node axes · `Space` pause animation · `E` export JSON

**Panel**

- **View & camera (C, E):** view layout (main + inspection inset, split, main only, inspection only); projection; fov, near, far, ortho height; quaternion orbit (bonus); viewpoint buttons (*Front*, *Painting match*, *Left*, *Top*) with a smooth transition; *Allow pitch ±90°* and *Look straight down* to test the up-parallel case in `lookAt`; *Reset scene*.
- **Part A:** `M = T·R·S` / `M = S·R·T` switch, translation x/y/z, rotation axis and angle, uniform scale. The matrix panel (bottom left) prints **both** matrices and marks the active one.
- **Part B:** turn the animation on or off and set its speed; base and joint angles of the lamp arm. *Show tree* prints the hierarchy with every local transform and the world matrix of the leaf `lamp-bulb`.
- **Debug drawings:** node local axes, main-camera frustum (drawn in the inspection view), grid + world axes, control polygon, de Casteljau construction, control points.
- **Part D:** curve type (piecewise Bézier C¹ / Catmull–Rom through the knots), parameter `t`, animate the object along the curve (it is oriented by the tangent), *Place new curve* / *Finish placing* (3n + 1 points; 10 points give 3 segments), *Reset curve*, *Export JSON* (downloads `curve.json`).
- **Bonus:** GPU ribbon (compute shader), surface of revolution of the traced curve, least-squares fit display.
- **Read-outs:** pick what the bottom-left panel shows: Part A matrices, the scene graph, V and P, or the curve and the last JSON export.

The HUD (top left) always shows frame time and fps, **vertices submitted per frame**, draw calls, the GPU name, and the main camera's eye, target, up, fov, near and far. It warns when `up` is parallel to the view direction.

## Code layout

```
src/
  math/     mat4.js camera.js curves.js quat.js curves.wgsl.js  ← matrix, camera, curve maths
            vec3.js todo.js                                      ← helpers
  scene/    node.js        SceneNode: local, parent, children, world = parent.world · local
            sceneGraph.js  the scene (painting + frame, table, animated lamp, plate, Part A object, curve rider)
            meshes.js      cube, quad, sphere, cone, cylinder, surface of revolution
            curveModel.js  control points, segment lookup, sampling, JSON export
  render/   renderer.js    WebGPU device, pipelines, one uniform slot per draw (dynamic offsets), passes per view
            shaders.js     WGSL (lit/textured mesh, coloured lines/triangles, ribbon)
            gpuRibbon.js   compute shader that evaluates the curve and writes a ribbon vertex buffer
            color.js       sRGB → linear
  ui/       panel.js controls.js  side panel
            info.js hud.js        HUD + matrix read-outs
            orbit.js              Euler / quaternion orbit camera, viewpoints
            picking.js input.js   mouse ray → painting plane, dragging, keyboard
            todoPanel.js          lists any maths function that is still missing
  main.js   frame loop: animate → locals → traversal → cameras → draw lists → submit
tests/      node:test unit tests for mat4, camera, curves, quat
public/kavunlu.jpg   the painting (720 × 502)
curve.json           exported curve (default trace; re-export your own)
docs/REPORT_OUTLINE.md   what the PDF report must contain
```

### Conventions

- Matrices: `Float32Array(16)`, **column-major** (`m[c*4 + r]`), column vectors, `p' = M·p`. They are uploaded to the uniform buffer as they are.
- Model matrices: `M = T·R·S` (scale first, then rotate, then translate) everywhere except where the Part A switch selects `S·R·T`.
- World: right-handed, y up. The painting lies in the plane z = 0, centred at (0, 1.6, 0), 4 × 2.79 units. The table top is y = 0.
- View space: the camera looks down −z. Clip space is WebGPU's: z ∈ [0, 1]. Depth is cleared to 1 and compared with `less`.
- Colour: the painting is an `rgba8unorm-srgb` texture and lighting is done in linear space. The output is encoded by an `-srgb` view of the canvas; if a browser does not offer that view, the fragment shaders encode sRGB themselves (the HUD shows which path is active, and `?srgb=manual` forces the fallback).
- Curve coordinates: normalised painting coordinates, (0, 0) at bottom-left and (1, 1) at top-right.

## Deliverables checklist

- [x] All functions in `src/math/` implemented, `npm test` green
- [ ] Trace your own shape and export it → replace `curve.json`
- [ ] `report.pdf` in the repository root (see `docs/REPORT_OUTLINE.md`)
- [x] Tag `project1-final`
- [ ] Optional: demo video (≤ 3 min)
