// Feature contracts for the 4.6 additions: library search/export, the
// reset-authenticator loop, custom vocabulary, wake lock, and the PWA
// shell whose service worker must NEVER touch API or cross-origin traffic.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listParams, likePattern } from '../functions/api/notes/store.js';
import { markdown as exportMarkdown } from '../functions/api/notes/export.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const indexJs = read('public/index.js');
const swJs = read('public/sw.js');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const html = read('public/index.html');

describe('library search', () => {
  it('parses the optional q param and trims it', () => {
    const r = listParams(new URLSearchParams('kind=note&q=  hello '));
    assert.equal(r.ok, true);
    assert.equal(r.value.q, 'hello');
    assert.equal(listParams(new URLSearchParams('kind=note&q=%20%20')).value.q, null, 'whitespace-only q is dropped');
  });

  it('escapes LIKE wildcards so user input cannot wildcard freely', () => {
    assert.equal(likePattern('50%_done\\'), '%50\\%\\_done\\\\%');
  });
});

describe('bulk export', () => {
  const rows = [
    { id: '1', kind: 'note', text: 'first note', source_device: 'phone', created_at: '2026-09-13T10:00:00Z', updated_at: '', pinned: 1 },
    { id: '2', kind: 'clip', text: 'a clip', source_device: null, created_at: '2026-09-13T11:00:00Z', updated_at: '', pinned: 0 },
  ];
  it('renders grouped markdown with pinned markers and devices', () => {
    const md = exportMarkdown(rows, '2026-09-13T12:00:00Z');
    assert.match(md, /# LumiNote export/);
    assert.match(md, /## Notes/);
    assert.match(md, /## Clips/);
    assert.match(md, /first note/);
    assert.match(md, /pinned/);
    assert.match(md, /\(from phone\)/);
    assert.doesNotMatch(md, /## Transcripts/, 'empty kinds are omitted');
  });
  it('says when there is nothing', () => {
    assert.match(exportMarkdown([], 'x'), /Nothing saved yet/);
  });
});

describe('reset authenticator', () => {
  it('exists, requires proof of possession, and wipes the login rows', () => {
    const resetFn = read('functions/api/auth/reset.js');
    assert.match(resetFn, /verifyTotp\(secretB32, code\)/);
    assert.match(resetFn, /consumeRecoveryCode/);
    assert.match(resetFn, /totp_secret', 'totp_confirmed', 'totp_recovery'/);
    assert.match(resetFn, /status: 401/);
  });
  it('the dialog ships the two-step reset controls', () => {
    for (const id of ['linkAuthResetBtn', 'linkAuthResetRow', 'linkAuthResetInput', 'linkAuthResetConfirmBtn']) {
      assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
    }
    assert.match(indexJs, /\/api\/auth\/reset/);
  });
});

describe('custom vocabulary (keyterms)', () => {
  it('injects the official parameter into AssemblyAI sessions only', () => {
    assert.match(indexJs, /keyterms_prompt=/);
    assert.match(indexJs, /KEYTERMS_MAX = 100/);
    assert.match(indexJs, /KEYTERMS_MAX_LEN = 50/);
    // Deepgram has no keyterms param — the injection must sit in the
    // AssemblyAI endpoint construction, not a shared URL.
    const endpoint = indexJs.match(/const endpoint = `wss:\/\/streaming\.assemblyai\.com[^`]*`;/);
    assert.ok(endpoint && endpoint[0].includes('${keytermsParam}'));
  });
  it('the dialog ships editor, save, and status controls', () => {
    for (const id of ['vocabBtn', 'vocabOverlay', 'vocabInput', 'vocabSaveBtn']) {
      assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
    }
  });
});

describe('voice pipeline wiring', () => {
  it('the client runs the pipeline on committed turns and relays scratch', () => {
    const workerProtocol = read('worker/src/protocol.js');
    assert.match(indexJs, /processSpokenTurn\(text, getCorrections\(\)\)/);
    assert.match(indexJs, /CORRECTIONS_STORAGE_KEY/);
    assert.match(indexJs, /type: "scratch"/);
    assert.match(indexJs, /case "scratch":/);
    assert.match(workerProtocol, /'scratch'/, 'scratch is a relayed client message type');
  });

  it('Polish AI sends the selected output mode', () => {
    assert.match(html, /id="outputMode"/);
    for (const option of ['clean', 'bullets', 'email']) {
      assert.match(html, new RegExp(`value="${option}"`));
    }
    assert.match(indexJs, /mode: outputMode\?\.value \|\| 'clean'/);
  });
});

describe('credits & community files', () => {
  const creditsHtml = read('public/credits.html');
  const license = read('LICENSE');
  const contributing = read('CONTRIBUTING.md');

  it('LICENSE belongs to this project, not its scaffolding origin', () => {
    assert.match(license, /Copyright \(c\) 2026 rakxdev/);
    assert.doesNotMatch(license, /AssemblyAI/, 'the scaffold-era copyright must stay gone');
    assert.match(license, /MIT License/);
  });

  it('the credits page credits the maker, dependencies with licenses, and the MIT grant', () => {
    assert.match(creditsHtml, /Made by <em>rakxdev<\/em>/);
    for (const name of ['AssemblyAI', 'Deepgram', 'Cloudflare', 'LanguageTool', 'otpauth', 'qrcode-generator', 'anime.js', 'SIL OFL']) {
      assert.ok(creditsHtml.includes(name), `credits page missing "${name}"`);
    }
    assert.match(creditsHtml, /MIT License/);
    assert.match(creditsHtml, /CONTRIBUTING\.md/);
    // Every library link points at a real upstream, not a placeholder.
    assert.match(creditsHtml, /github\.com\/hectorm\/otpauth/);
    assert.match(creditsHtml, /github\.com\/kazuhikoarase\/qrcode-generator/);
  });

  it('the app and changelog footers link the credits page', () => {
    assert.match(html, /href="\/credits"/);
    assert.match(read('public/changelog.html'), /href="\/credits"/);
  });

  it('community files meet the GitHub standards checklist', () => {
    assert.match(contributing, /check:fast/);
    assert.match(contributing, /CONSTRAINTS\.md/);
    assert.match(contributing, /logical change per commit/);
    assert.ok(read('CODE_OF_CONDUCT.md').includes('Code of Conduct'));
  });
});

describe('wake lock', () => {
  it('is acquired on record, re-armed on visibility, released on stop', () => {
    assert.match(indexJs, /navigator\.wakeLock\.request\("screen"\)/);
    assert.match(indexJs, /if \(recording\) acquireWakeLock\(\); else releaseWakeLock\(\);/);
    assert.match(indexJs, /if \(isRecording\) acquireWakeLock\(\);/);
  });
});

describe('PWA shell', () => {
  it('manifest is installable: standalone, themed, with any + maskable icons', () => {
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
    assert.ok(manifest.icons.every((i) => /^\//.test(i.src)));
  });

  it('the service worker never touches API or cross-origin traffic', () => {
    assert.match(swJs, /request\.method !== 'GET'/);
    assert.match(swJs, /url\.origin !== self\.location\.origin/);
    assert.match(swJs, /url\.pathname\.startsWith\('\/api\/'\)/);
    assert.match(swJs, /network-first|network first|fetch\(request\)/, 'freshness-first strategy present');
    // Hard guarantee: the API path string must appear in a guard, not in a
    // cache list.
    const precache = swJs.match(/const PRECACHE = \[[\s\S]*?\];/)[0];
    assert.doesNotMatch(precache, /\/api\//);
  });

  it('icons exist on disk and the page wires manifest + iOS metas', () => {
    for (const f of ['public/icon-192.png', 'public/icon-512.png', 'public/icon-180.png']) {
      assert.ok(readFileSync(join(ROOT, f)).length > 1000, `${f} missing or tiny`);
    }
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.match(html, /rel="apple-touch-icon" href="icon-180\.png"/);
    assert.match(indexJs, /serviceWorker\.register\("\/sw\.js"\)/);
  });
});
