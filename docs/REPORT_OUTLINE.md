# Report outline (3–5 pages, PDF)

Write the text, derivations and measurements yourself. The application gives you the evidence: screenshots and on-screen read-outs.

## 1. Painting
- Şeker Ahmed Paşa, *Kavunlu Natürmort*, Sakıp Sabancı Museum. Say why you chose it (strong organic contours for curve tracing; a table edge that gives a perspective cue).

## 2. Part A — transformations
- Screenshot of **T·R·S** and **S·R·T** with the matrix panel visible (*Read-outs → Part A*).
- One paragraph: why the results differ (in S·R·T the translation is rotated and scaled too), and which convention the rest of the code uses (T·R·S, column vectors, column-major).

## 3. Part B — scene graph
- Tree diagram. The panel prints it: *Read-outs → Part B*.
- The world matrix of `lamp-bulb` written as `M_table · M_base · M_arm1 · M_arm2 · M_head · M_bulb`, multiplied out by hand for one paused frame (*Space*) and compared with the printed matrix.
- Screenshot with the node axes on.

## 4. Part C — camera and projection
- Derivation of `lookAt`: forward = normalize(eye − target), right = up × forward, true up = forward × right; the rotation rows and the translation −Rᵀ·eye. The degenerate case and how you handle it (*Look straight down* shows it).
- Derivation of the WebGPU perspective matrix (z: near → 0, far → 1) and of the orthographic matrix.
- Screenshots: the same scene in perspective and orthographic; the frustum in the inspection view.
- Near/far discussion: the default is 0.1 / 20. Explain how far/near affects depth precision (try near = 0.01 with far = 200 and look for z-fighting on the frame and the table).

## 5. Part D — curves
- Bernstein basis functions of the cubic Bézier; proof that B(0) = P₀ and B(1) = P₃.
- C¹ condition at a joint: P₃ − P₂ = P₄ − P₃ (the handles are opposite and of equal length).
- Catmull–Rom: tangent (p₂ − p₀)/2, and the curve passes through the knots.
- Screenshot of the traced shape over the painting with the de Casteljau construction.

## 6. Bonus (state which ones you did)
- Least-squares fit (Shift-drag), surface of revolution, *Painting match* viewpoint (argue the eye height and fov from the painted table and the melon's ellipse), quaternion orbit with slerp, compute-shader ribbon.

## 7. What went wrong and how you found it

## 8. Performance
- Frame time and vertices per frame from the HUD, for a few configurations; state your GPU (the HUD prints the adapter).

## Appendix A — exported curve JSON (`curve.json`)

## Appendix B — AI use
The handout requires: tool, what you asked, what you kept.
