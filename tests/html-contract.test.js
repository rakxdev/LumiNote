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
const css = readFileSync(join(publicDir, 'styles.css'), 'utf8');

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

  it('commits the active turn on the AssemblyAI end_of_turn signal', () => {
    // v3 turns are only relayed to linked devices when commitActiveTurn()
    // runs, and it ran solely on a NEW turn_order arriving. The server's
    // end_of_turn flag (official endpointing signal) was ignored, so the
    // last finalized sentence never reached the second device (reported
    // bug). The Turn handler must commit when end_of_turn is true.
    const js = readFileSync(join(publicDir, 'index.js'), 'utf8');
    const turnBranch = js.match(/if \(msg\.type === "Turn"\) \{[\s\S]*?\} else if \(msg\.type === "Termination"\)/);
    assert.ok(turnBranch, 'AssemblyAI Turn handler not found');
    assert.ok(
      /end_of_turn[\s\S]{0,200}?commitActiveTurn\(\)/.test(turnBranch[0]),
      'Turn handler must call commitActiveTurn() when msg.end_of_turn is true'
    );
  });

  it('limits the manual join-code input to the 6-character room code length', () => {
    // Room codes are exactly 6 characters (ROOM_CODE_LENGTH in link-protocol.js),
    // but the input previously allowed 12, so the field accepted "any length"
    // of typing before the Join button rejected it (reported bug).
    const tag = html.match(/<input[^>]*id="linkJoinInput"[^>]*>/);
    assert.ok(tag, 'linkJoinInput element is missing');
    assert.ok(
      /maxlength="6"/.test(tag[0]),
      'linkJoinInput must cap input at 6 characters to match ROOM_CODE_LENGTH'
    );
  });

  it('configures quiet-voice accuracy params on the AssemblyAI session', () => {
    // Reported complaint: dictation misses quiet speech. The official v3
    // docs: lowering vad_threshold lets soft audio register as speech, and
    // voice_focus suppresses background audio before the model (which keeps
    // the lower VAD threshold safe from noise false-positives). Mic
    // auto-gain normalizes quiet voices before any model sees the audio.
    const js = readFileSync(join(publicDir, 'index.js'), 'utf8');
    const endpoint = js.match(/const endpoint = `wss:\/\/streaming\.assemblyai\.com[^`]*`;/);
    assert.ok(endpoint, 'AssemblyAI endpoint not found');
    assert.match(endpoint[0], /vad_threshold=0\.1/, 'vad_threshold must be lowered so quiet speech registers');
    assert.match(endpoint[0], /voice_focus=near-field/, 'voice_focus must suppress background before the model');
    assert.match(js, /autoGainControl:\s*true/, 'mic auto-gain must be enabled for quiet voices');
  });

  it('keeps the link overlay closed while the hidden attribute is set', () => {
    // The overlay element ships with the `hidden` attribute; any author
    // `display` rule on .link-overlay overrides the UA [hidden] rule, so a
    // matching [hidden] { display: none } re-assertion must exist. Without
    // it the pairing modal renders open on every page load (reported bug).
    assert.ok(
      /<div[^>]*class="link-overlay"[^>]*hidden/.test(html) ||
        /<div[^>]*hidden[^>]*class="link-overlay"/.test(html),
      'linkOverlay element should start hidden'
    );
    const overlaySetsDisplay = /\.link-overlay\s*{[^}]*display\s*:/.test(css);
    if (overlaySetsDisplay) {
      assert.ok(
        /\.link-overlay\[hidden\]\s*{[^}]*display\s*:\s*none/.test(css),
        '.link-overlay[hidden] { display: none } is missing — the modal would be visible on every page load'
      );
    }
  });

  it('routes fresh remote pushes into the editor AND the tray, replays only into the tray', () => {
    // Pushed clipboard payloads are meant to land in both places on the
    // receiving device (user-specified behavior), while reconnect snapshots
    // re-deliver the same clipboard and must not duplicate it into the
    // editor. showRemoteClipboard therefore takes a { replay } flag.
    const js = readFileSync(join(publicDir, 'index.js'), 'utf8');
    const fn = js.match(/function showRemoteClipboard\(text, \{ replay = false \} = \{\}\) \{[\s\S]*?\n\}/);
    assert.ok(fn, 'showRemoteClipboard must accept a { replay } option');
    assert.match(fn[0], /if \(!replay\) appendRemoteClipboardToEditor\(text\)/);
    const snapshot = js.match(/applySnapshot\(snapshot\) \{[\s\S]*?\n {2}\}/);
    assert.ok(snapshot && /showRemoteClipboard\(snapshot\.clipboard\.text, \{ replay: true \}\)/.test(snapshot[0]),
      'snapshot catch-up must mark the clipboard delivery as a replay');
  });
});
