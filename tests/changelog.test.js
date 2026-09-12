// Changelog contract: changelog.json is the single version source. It feeds
// the /changelog page and the header version seal, so its structure and its
// agreement with package.json are load-bearing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8'));
const changelog = JSON.parse(readFileSync(`${ROOT}public/changelog.json`, 'utf8'));
const changelogHtml = readFileSync(`${ROOT}public/changelog.html`, 'utf8');
const indexHtml = readFileSync(`${ROOT}public/index.html`, 'utf8');
const indexJs = readFileSync(`${ROOT}public/index.js`, 'utf8');

const SECTION_KEYS = new Set(['added', 'changed', 'deprecated', 'removed', 'fixed', 'security']);

describe('changelog.json structure', () => {
  it('has entries sorted newest-first', () => {
    assert.ok(Array.isArray(changelog.entries) && changelog.entries.length >= 2);
    for (let i = 1; i < changelog.entries.length; i++) {
      const prev = changelog.entries[i - 1];
      const cur = changelog.entries[i];
      const [pMaj, pMin] = prev.version.split('.').map(Number);
      const [cMaj, cMin] = cur.version.split('.').map(Number);
      assert.ok(
        prev.date > cur.date || (prev.date === cur.date && (pMaj > cMaj || (pMaj === cMaj && pMin > cMin))),
        `entry ${i} (${cur.version}) is not older than ${prev.version}`
      );
    }
  });

  it('every entry has a semver version, ISO date, status, and valid sections', () => {
    for (const entry of changelog.entries) {
      assert.match(entry.version, /^\d+\.\d+\.\d+$/, entry.version);
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(entry.status, 'released');
      assert.ok(entry.sections && typeof entry.sections === 'object');
      for (const [key, items] of Object.entries(entry.sections)) {
        assert.ok(SECTION_KEYS.has(key), `unknown section "${key}" in ${entry.version}`);
        assert.ok(Array.isArray(items) && items.length > 0, `${key} empty in ${entry.version}`);
        for (const item of items) assert.equal(typeof item, 'string');
      }
    }
  });

  it('latest entry version matches package.json (single version source)', () => {
    assert.equal(changelog.entries[0].version, pkg.version);
  });
});

describe('changelog consumers', () => {
  it('/changelog page fetches the json and renders into #changelogRoot', () => {
    assert.match(changelogHtml, /fetch\('\.\/changelog\.json'\)/);
    assert.match(changelogHtml, /id="changelogRoot"/);
  });

  it('the app seal derives from changelog.json with a silent fallback', () => {
    assert.match(indexJs, /fetch\('\/changelog\.json'\)/);
    assert.match(indexJs, /\.packet-seal/);
    assert.match(indexHtml, /class="packet-seal"/);
  });

  it('the app footer links to /changelog', () => {
    assert.match(indexHtml, /href="\/changelog"/);
  });
});
