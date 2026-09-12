// Asset self-hosting contract: the app must load with zero third-party
// requests, and every locally referenced asset must actually exist.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');

const indexHtml = read('public/index.html');
const changelogHtml = read('public/changelog.html');
const fontsCss = read('public/fonts.css');
const headers = read('public/_headers');

const THIRD_PARTY = /https?:\/\/(?!localhost)[\w.-]+\.[a-z]{2,}/i;

describe('no third-party origins in loadable references', () => {
  it('index.html links no external stylesheets or scripts', () => {
    const loadable = indexHtml
      .split('\n')
      .filter((line) => !/<!--/.test(line) && /<(script|link)\b/.test(line))
      .join('\n');
    assert.doesNotMatch(loadable, THIRD_PARTY, `external origin in: ${loadable}`);
  });

  it('changelog.html links no external stylesheets or scripts', () => {
    const loadable = changelogHtml
      .split('\n')
      .filter((line) => !/<!--/.test(line) && /<(script|link)\b/.test(line))
      .join('\n');
    assert.doesNotMatch(loadable, THIRD_PARTY);
  });

  it('security headers allow no third-party origins and always revalidate', () => {
    const csp = /Content-Security-Policy:\s*([^\n]+)/.exec(headers)?.[1] ?? '';
    assert.ok(csp, 'CSP header present');
    assert.doesNotMatch(csp, /https:\/\/(?!localhost)/, 'CSP whitelists an external origin');
    assert.match(headers, /Cache-Control:\s*no-cache/, 'static assets must always revalidate');
  });
});

describe('self-hosted assets exist', () => {
  it('index.html and changelog.html load the local font stylesheet', () => {
    assert.match(indexHtml, /href="fonts\.css"/);
    assert.match(changelogHtml, /href="fonts\.css"/);
    assert.doesNotMatch(indexHtml, /fonts\.googleapis\.com/);
  });

  it('every font file referenced by fonts.css exists on disk', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(urls.length >= 20, `expected ~23 font faces, found ${urls.length}`);
    for (const url of urls) {
      assert.ok(existsSync(`${ROOT}public/${url}`), `missing font file: ${url}`);
    }
  });

  it('fonts.css declares the four families with the used weights', () => {
    for (const family of ['Chakra Petch', 'Martel', 'JetBrains Mono', 'Yatra One']) {
      const faces = fontsCss.split('@font-face').filter((f) => f.includes(`'${family}'`));
      assert.ok(faces.length > 0, `${family} missing`);
      const weights = faces.map((f) => /font-weight:\s*(\d+)/.exec(f)?.[1]).filter(Boolean);
      assert.ok(weights.includes('400'), `${family} lacks a 400 face`);
    }
  });

  it('vendor libraries are local', () => {
    assert.ok(existsSync(`${ROOT}public/vendor/anime.min.js`), 'anime.min.js missing');
    assert.ok(existsSync(`${ROOT}public/vendor/qrcode.js`), 'qrcode.js missing');
    assert.match(indexHtml, /src="vendor\/anime\.min\.js"/);
    assert.match(indexHtml, /src="vendor\/qrcode\.js"/);
  });
});
