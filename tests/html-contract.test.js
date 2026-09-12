import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Regression guard: the Link Mode QR is rendered by the vendored
// qrcode-generator library, which index.html must load as a classic script
// BEFORE the deferred app module reads the `qrcode` global. When the tag was
// missing (file vendored but never referenced), the QR area rendered as a
// blank white box in production.
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');

describe('index.html script contract', () => {
  it('loads vendor/qrcode.js before the app module', () => {
    const qr = html.indexOf('src="vendor/qrcode.js"');
    const app = html.indexOf('src="index.js"');
    assert.notEqual(qr, -1, 'vendor/qrcode.js script tag is missing — the Link QR would not render');
    assert.notEqual(app, -1, 'app module script tag is missing');
    assert.ok(qr < app, 'vendor/qrcode.js must load before the app module');
  });

  it('loads vendor/qrcode.js as a classic (non-module) script', () => {
    const tag = html.match(/<script[^>]*src="vendor\/qrcode\.js"[^>]*>/);
    assert.ok(tag, 'vendor/qrcode.js script tag is missing');
    assert.ok(!tag[0].includes('type="module"'), 'qrcode.js is a UMD global script, not an ES module');
  });
});
