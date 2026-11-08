// Colours are written as sRGB hex (what you pick in a colour picker) and
// converted to LINEAR values, because the shaders work in linear space and the
// render target is an *-srgb view that re-encodes on write.
export function srgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => x / 255);
  return c.map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
}
