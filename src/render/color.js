// I write colours as sRGB hex (what a colour picker gives me) and convert them
// to LINEAR here, because my shaders do lighting in linear space and the
// output is encoded back to sRGB when it is written to the canvas.
export function srgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => x / 255);
  return c.map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
}
