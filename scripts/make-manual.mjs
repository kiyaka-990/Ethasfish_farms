// Builds the downloadable staff manual served at /manual/ethasfish-portal-manual.pdf.
//
// The manual is a designed HTML document (manual/ethasfish-operations-manual.html)
// that embeds the live screenshots in manual/assets/*.png. Printing it with a
// headless browser lays it out as A4 pages with the images intact.
//
//   node scripts/make-manual.mjs
//
// Requires Chrome or Edge installed (checked in the usual Windows/macOS/Linux
// locations). The PDF is committed, so deploys always have it even if nobody
// regenerates - re-run this after editing the HTML or replacing a screenshot.

import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'manual', 'ethasfish-operations-manual.html');
const OUT_DIR = join(ROOT, 'public', 'manual');
const TMP = join(ROOT, 'manual', 'ethasfish-operations-manual.pdf');
const SERVED = join(OUT_DIR, 'ethasfish-portal-manual.pdf');

if (!existsSync(SRC)) {
  console.error(`Manual source not found: ${SRC}`);
  process.exit(1);
}

const candidates = [
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge'
];

const browser = candidates.find(p => p && existsSync(p));
if (!browser) {
  console.error('No Chrome/Edge installation found - cannot print the manual to PDF.');
  console.error('Install Google Chrome or Microsoft Edge, then re-run this script.');
  process.exit(1);
}

const htmlUrl = 'file:///' + resolve(SRC).replace(/\\/g, '/');
const pdfPath = resolve(TMP).replace(/\\/g, '/');

console.log(`Using ${browser}`);
console.log(`Printing ${SRC} ...`);

const res = spawnSync(browser, [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--virtual-time-budget=20000',
  `--print-to-pdf=${pdfPath}`,
  htmlUrl
], { stdio: 'inherit', windowsHide: true });

if (res.status !== 0 || !existsSync(TMP)) {
  console.error('PDF print failed.');
  process.exit(res.status ?? 1);
}

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(TMP, SERVED);

const kb = (statSync(SERVED).size / 1024).toFixed(1);
console.log(`Wrote ${SERVED}`);
console.log(`Also kept at ${TMP} | Size: ${kb} KB`);
