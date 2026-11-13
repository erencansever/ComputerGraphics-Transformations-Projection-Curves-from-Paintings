// Helpers for the text read-outs (stats, camera parameters, matrices).

/** Formats a column-major 4×4 as four printed ROWS. */
export function fmtMat(m, w = 7, dp = 2) {
  if (!m) return '  (not available)';
  let s = '';
  for (let r = 0; r < 4; r++) {
    s += '│';
    for (let c = 0; c < 4; c++) {
      const v = m[c * 4 + r];
      s += (Math.abs(v) < 0.5 * 10 ** -dp ? 0 : v).toFixed(dp).padStart(w);
    }
    s += ' │\n';
  }
  return s;
}

export const fmtV = (v, dp = 2) => (v ? `(${v.map((x) => x.toFixed(dp)).join(', ')})` : '—');

/** Two matrices side by side with titles. */
export function sideBySide(a, b, titleA, titleB) {
  const A = fmtMat(a).trimEnd().split('\n'), B = fmtMat(b).trimEnd().split('\n');
  const pad = Math.max(...A.map((l) => l.length), titleA.length) + 3;
  let s = titleA.padEnd(pad) + titleB + '\n';
  for (let i = 0; i < 4; i++) s += A[i].padEnd(pad) + B[i] + '\n';
  return s;
}
