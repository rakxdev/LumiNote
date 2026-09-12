#!/usr/bin/env node
// check-ratchets.mjs — enforces the "Measured" ratchets recorded in
// CONSTRAINTS.md. CONSTRAINTS.md is the single source of truth: this script
// parses the floor/ceiling out of its table rows and compares fresh
// measurements against them. Improving a number means raising its floor
// (or lowering its ceiling) IN CONSTRAINTS.md, in the same commit.
// Exit: 0 within ratchets · 1 ratchet regressed or file unreadable.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const constraints = readFileSync(`${ROOT}CONSTRAINTS.md`, 'utf8');

const coverageRow = constraints.match(/coverage \(lines[^\n]*\|\s*([\d.]+)\s*\|\s*floor\s*([\d.]+)/i);
const assetsRow = constraints.match(/app assets[^\n]*\|\s*(\d+)\s*B\s*\|\s*ceiling\s*(\d+)/i);
if (!coverageRow || !assetsRow) {
  console.error('check-ratchets: could not parse ratchet rows from CONSTRAINTS.md');
  process.exit(1);
}
const coverageFloor = Number(coverageRow[2]);
const assetsCeiling = Number(assetsRow[2]);

// Fresh measurements.
const out = execFileSync('node', ['--test', '--experimental-test-coverage',
  ...readdirSync(`${ROOT}tests`).filter((f) => f.endsWith('.test.js')).map((f) => `tests/${f}`)],
  { encoding: 'utf8', cwd: ROOT, shell: false });
const coverage = Number((out.match(/# all files\s*\|\s*([\d.]+)/) ?? [])[1]);
if (!Number.isFinite(coverage)) {
  console.error('check-ratchets: could not parse coverage from the test run');
  process.exit(1);
}

let bytes = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'vendor' || name === 'fonts') continue; // pinned third-party + generated subsets
    const p = `${dir}/${name}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css)$/.test(name)) bytes += statSync(p).size;
  }
};
walk(`${ROOT}public`);

let failed = false;
if (coverage < coverageFloor) {
  console.error(`check-ratchets: line coverage ${coverage}% fell below floor ${coverageFloor}%`);
  failed = true;
} else if (coverage > coverageFloor + 0.5) {
  console.log(`check-ratchets: coverage improved to ${coverage}% — raise the floor in CONSTRAINTS.md`);
}
if (bytes > assetsCeiling) {
  console.error(`check-ratchets: app assets ${bytes} B exceed ceiling ${assetsCeiling} B — name the reason in the commit and raise the ceiling, or shrink the payload`);
  failed = true;
}

if (failed) process.exit(1);
console.log(`check-ratchets: within ratchets (coverage ${coverage}% ≥ ${coverageFloor}%, assets ${bytes} B ≤ ${assetsCeiling} B)`);
