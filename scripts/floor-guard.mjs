#!/usr/bin/env node
// floor-guard.mjs — diff-scoped enforcement of the CONSTRAINTS.md floor.
// Adapted from the constraint-driven-development skill's reference implementation.
// Usage: node scripts/floor-guard.mjs [--base <ref>]   (default base: HEAD —
// catches uncommitted work where this repo's loop actually runs; pass
// --base origin/master at review time to scan the whole branch.)
//
// Exit codes: 0 clean · 1 floor violation · 2 could not run.
// Reports the rule and the location, never the matched secret value.
import { execFileSync } from 'node:child_process';

const base = (() => {
  const i = process.argv.indexOf('--base');
  return i > -1 ? process.argv[i + 1] : 'HEAD';
})();

const git = (args) => {
  try {
    // Large diffs (a whole branch vs origin/master) blow past execFileSync's
    // 1 MB default buffer — a buffer throw must not silently read as "empty
    // diff, clean".
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    // `git diff --no-index` exits 1 WHEN DIFFERENCES EXIST — that is the
    // untracked-file scan's success path, so a failure that still produced
    // output returns the output. A hard failure (bad ref, unreadable file)
    // returns null, and the main-diff caller turns that into exit 2 rather
    // than a false "clean".
    const out = e.stdout ? e.stdout.toString() : '';
    if (e.status !== undefined && out) return out;
    return null;
  }
};

const mergeBase = base === 'HEAD' ? 'HEAD' : git(['merge-base', base, 'HEAD'])?.trim();
if (!mergeBase) { console.error(`floor-guard: no merge base against ${base}`); process.exit(2); }

// Unified diff plus untracked files (git diff alone cannot see new files).
const tracked = git(['diff', '--unified=0', mergeBase, '--']);
if (tracked === null) {
  console.error(`floor-guard: could not diff against ${base} (guard did not run)`);
  process.exit(2);
}
const untracked = (git(['ls-files', '--others', '--exclude-standard']) ?? '')
  .split('\n').filter(Boolean)
  .map((f) => git(['diff', '--no-index', '--unified=0', '/dev/null', f]) ?? '')
  .join('\n');
const diff = tracked + '\n' + untracked;

const added = [], removed = [];
let file = '';
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) file = line.slice(6);
  else if (line.startsWith('+') && !line.startsWith('+++')) added.push({ file, text: line.slice(1) });
  else if (line.startsWith('-') && !line.startsWith('---')) removed.push({ file, text: line.slice(1) });
}

const findings = [];
const flag = (rule, f, text) => findings.push({ rule, file: f, text: text.trim().slice(0, 120) });
// Secret findings are reported WITHOUT the matched text.
const flagSecret = (rule, f) => findings.push({ rule, file: f, text: '(redacted)' });

// 1. Silenced checker.
const SUPPRESSIONS = /@ts-ignore|@ts-nocheck|eslint-disable|biome-ignore|# *noqa|# *type: *ignore|istanbul ignore|nosemgrep|gitleaks:allow|Stryker disable/;
// 4. Unfinished work. Empty catch is NOT flagged — the project's lint config
// deliberately allows it for teardown paths (see CONSTRAINTS.md floor).
const STUBS = /throw new (Error|NotImplemented).*[Nn]ot implemented|\bTODO\b/;
// 2. A test made easier (added skips — node:test uses test.skip/it.skip).
const SKIPS = /\.(skip|todo)\b|\bxit\(|\bxdescribe\(/;
// Floor: secret-shaped strings. Placeholders in example files are fine.
const SECRET = /(sk-[A-Za-z0-9_-]{20,}|cfut_[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9_-]{20,}|api[_-]?key\s*[:=]\s*["'][^"']{8,}["'])/i;
const PLACEHOLDER = /your_|YOUR_|<[^>]+>|\.\.\.|example/i;
const isExample = (f) => /\.example$|\.example\/|\.md$/.test(f);

// The guard must quote the patterns it enforces, and CONSTRAINTS.md must
// state them; neither quotes a real suppression. Constraint-weakening and
// new-exception checks below stay active for those files regardless.
const SELF = /(^|\/)scripts\/floor-guard\.mjs$/;
const FLOOR_BULLET = /^- (No |This file )/;

for (const { file, text } of added) {
  if (SELF.test(file)) continue;
  const isFloorBullet = file === 'CONSTRAINTS.md' && FLOOR_BULLET.test(text.trim());
  if (!isFloorBullet) {
    if (SUPPRESSIONS.test(text)) flag('silenced-checker', file, text);
    if (STUBS.test(text)) flag('unfinished-work', file, text);
    if (SKIPS.test(text)) flag('test-made-easier', file, text);
    if (SECRET.test(text) && !(isExample(file) && PLACEHOLDER.test(text))) flagSecret('secret-in-source', file);
  }
  if (/CONSTRAINTS\.md$/.test(file) && /^\| *(W|E)\d+ *\|/.test(text)) flag('new-exception', file, text);
}

// 2b. Assertion removed from a test file that still exists (node:test asserts).
for (const { file, text } of removed) {
  if (/(tests\/|\.(test|spec)\.|_test\.)/.test(file) && /\b(assert|expect|should)\b/.test(text)) {
    flag('assertion-removed', file, text);
  }
}

// 1b/2c. Loosened bar: any line REMOVED from CONSTRAINTS.md that carried a
// number or a floor bullet. Tightening (additions/renumbering upward) is silent.
for (const { file, text } of removed) {
  if (/CONSTRAINTS\.md$/.test(file) && (/\d/.test(text) || /^- [A-Z]/.test(text.trim()))) {
    flag('constraint-weakened', file, text);
  }
}

if (findings.length) {
  console.error(`floor-guard: ${findings.length} finding(s) against base ${base}`);
  for (const f of findings) console.error(`  [${f.rule}] ${f.file}: ${f.text}`);
  process.exit(1);
}
console.log(`floor-guard: clean (base ${base}, ${added.length} added / ${removed.length} removed lines scanned)`);
