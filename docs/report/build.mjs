// Prints docs/report/report.html to report.pdf (repository root) with
// headless Chrome. report.html already contains the Bernstein plot
// (bernstein.svg), the measurement table (measurements.json) and curve.json;
// if you re-export the curve or re-measure, update those parts of report.html.
//   node docs/report/build.mjs            (CHROME=/path/to/chrome to override)
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

execFileSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${path.join(root, 'report.pdf')}`,
  'file://' + path.join(here, 'report.html'),
], { stdio: 'ignore' });
console.log('wrote report.pdf');
