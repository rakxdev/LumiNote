// Feature contracts for the 4.6 additions: library search/export, the
// reset-authenticator loop, custom vocabulary, wake lock, and the PWA
// shell whose service worker must NEVER touch API or cross-origin traffic.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listParams, likePattern } from '../functions/api/notes/store.js';
import { escapeMarkdown, mdRow, onRequestGet as exportGet } from '../functions/api/notes/export.js';

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
  it('renders a row with pinned marker, device attribution, and inert text', () => {
    const row = { kind: 'note', text: '# forged heading\n<img src=x onerror=alert(1)>', source_device: 'phone', created_at: '2026-09-13T10:00:00Z', updated_at: '', pinned: 1 };
    const md = mdRow(row);
    assert.match(md, /^### 2026-09-13T10:00:00Z • pinned \(from phone\)/);
    assert.match(md, /\\# forged heading/, 'line-leading structure is defused');
    assert.match(md, /&lt;img src=x onerror=alert\(1\)&gt;/, 'inline HTML is escaped');
  });

  it('escapeMarkdown defuses line-leading structure but leaves normal text', () => {
    assert.equal(escapeMarkdown('normal text'), 'normal text');
    assert.equal(escapeMarkdown('- not a list'), '\\- not a list');
    // '>' is HTML-escaped first and the entity renders literally — inert.
    assert.equal(escapeMarkdown('> not a quote'), '&gt; not a quote');
    assert.equal(escapeMarkdown('```code```'), '\\`\\`\\`code```');
  });
});

describe('reset authenticator', () => {
  it('exists, requires proof of possession, and wipes the login rows and room windows', () => {
    const resetFn = read('functions/api/auth/reset.js');
    assert.match(resetFn, /verifyTotp\(secretB32, code\)/);
    assert.match(resetFn, /burnRecoveryCode\(env, code\)/);
    assert.match(resetFn, /totp_secret', 'totp_confirmed', 'totp_recovery'/);
    assert.match(resetFn, /room_auth:%'/, 'a reset must close every room trust window');
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


describe('export handler (streaming + pagination)', () => {
  it('streams every D1 page with structure escaped, ending cleanly', async () => {
    const page1 = Array.from({ length: 200 }, (_, i) => ({
      id: 'a' + i, kind: 'note', text: 'note ' + i + ' <b>x</b>', source_device: 'phone',
      created_at: 'T' + i, updated_at: 'T' + i, pinned: 0,
    }));
    const page2 = [{ id: 'b', kind: 'clip', text: '<b>clip</b>', source_device: null, created_at: 'T2', updated_at: 'T2', pinned: 0 }];
    let call = 0;
    const env = { DB: { prepare: () => ({
      bind: () => ({
        first: async () => null, // no totp rows: the login guard stays open
        all: async () => (call++ === 0 ? { results: page1 } : { results: page2 }),
      }),
    }) } };
    const res = await exportGet({ env, request: new Request('https://x/api/notes/export?format=md') });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('Content-Disposition'), /attachment/);
    const text = await res.text();
    assert.match(text, /# LumiNote export/);
    assert.match(text, /## Clips/, 'the second D1 page is included — no silent truncation');
    assert.match(text, /&lt;b&gt;clip&lt;\/b&gt;/, 'user HTML is escaped');
    assert.ok(!/&lt;b&gt;x&lt;\/b&gt;&lt;b&gt;/.test(text), 'no duplicated tail rows across the page boundary');
  });

  it('refuses the export when login is confirmed and no cookie is present', async () => {
    // Discriminate on the bound key: both settings queries share the SQL.
    const settings = { totp_secret: 'S', totp_confirmed: '1' };
    const env = { DB: { prepare: () => ({
      bind: (key) => ({
        first: async () => (settings[key] !== undefined ? { value: settings[key] } : null),
        run: async () => ({ meta: { changes: 0 } }),
      }),
    }) } };
    const res = await exportGet({ env, request: new Request('https://x/api/notes/export') });
    assert.equal(res.status, 401);
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

  it('the service worker bounds its cache and falls back on failed responses', () => {
    assert.match(swJs, /CACHE_MAX_ENTRIES/);
    assert.match(swJs, /putTrimmed/);
    assert.match(swJs, /hit \|\| res/, 'a resolved 5xx falls back to the cached copy');
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
