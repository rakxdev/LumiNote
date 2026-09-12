// Authenticator login (TOTP) contract: the pure helpers are the security
// core — token verification window, recovery-code burn semantics, and the
// signed-cookie round trip are all load-bearing and unit-tested here. The
// D1 access stays a thin key/value layer on top of them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateSecretB32,
  buildTotp,
  verifyTotp,
  generateRecoveryCodes,
  hashCode,
  consumeRecoveryCode,
  signAuthCookie,
  verifyAuthCookie,
  parseCookieHeader,
  authCookieHeader,
  constantTimeEqual,
  AUTH_COOKIE,
  AUTH_TTL_SECONDS,
  RECOVERY_CODE_COUNT,
} from '../functions/api/auth/totp.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const wsFn = readFileSync(join(ROOT, 'functions/api/link/ws.js'), 'utf8');
const indexJs = readFileSync(join(ROOT, 'public/index.js'), 'utf8');
const indexHtml = readFileSync(join(ROOT, 'public/index.html'), 'utf8');

describe('TOTP secrets and token verification', () => {
  it('generates base32 secrets that build working verifiers', () => {
    const b32 = generateSecretB32();
    assert.match(b32, /^[A-Z2-7]+=*$/, 'secret must be standard base32');
    const totp = buildTotp(b32);
    assert.equal(verifyTotp(b32, totp.generate()), true, 'current token verifies');
  });

  it('accepts ±1 period of clock skew and nothing wider', () => {
    const b32 = generateSecretB32();
    const totp = buildTotp(b32);
    const now = Date.now();
    assert.equal(verifyTotp(b32, totp.generate({ timestamp: now - 30_000 })), true, 'previous period');
    assert.equal(verifyTotp(b32, totp.generate({ timestamp: now + 30_000 })), true, 'next period');
    assert.equal(verifyTotp(b32, totp.generate({ timestamp: now - 90_000 })), false, 'two periods back');
    assert.equal(verifyTotp(b32, totp.generate({ timestamp: now + 90_000 })), false, 'two periods ahead');
  });

  it('rejects malformed codes instead of throwing', () => {
    const b32 = generateSecretB32();
    assert.equal(verifyTotp(b32, '12345'), false);
    assert.equal(verifyTotp(b32, '1234567'), false);
    assert.equal(verifyTotp(b32, 'abcdef'), false);
    assert.equal(verifyTotp(b32, ''), false);
    assert.equal(verifyTotp(b32, null), false);
    assert.equal(verifyTotp(b32, undefined), false);
  });

  it('the otpauth URI is Google Authenticator compatible', () => {
    const uri = buildTotp(generateSecretB32()).toString();
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.match(uri, /issuer=LumiNote/);
  });
});

describe('recovery codes', () => {
  it('generates the expected count in XXXX-XXXX format', () => {
    const codes = generateRecoveryCodes();
    assert.equal(codes.length, RECOVERY_CODE_COUNT);
    for (const c of codes) assert.match(c, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(new Set(codes).size, codes.length, 'codes must be unique');
  });

  it('burns a code exactly once and only from the stored set', async () => {
    const codes = generateRecoveryCodes();
    const hashes = [];
    for (const c of codes) hashes.push(await hashCode(c));
    const stored = JSON.stringify(hashes);

    const remaining = await consumeRecoveryCode(stored, codes[3]);
    assert.ok(remaining, 'valid code must consume');
    assert.equal(remaining.length, codes.length - 1);
    assert.equal(
      await consumeRecoveryCode(JSON.stringify(remaining), codes[3]),
      null,
      'a burned code cannot be reused'
    );
    assert.equal(await consumeRecoveryCode(stored, 'ZZZZ-ZZZZ'), null, 'unknown code');
    assert.equal(await consumeRecoveryCode('[]', codes[0]), null, 'empty store');
    assert.equal(await consumeRecoveryCode('not json', codes[0]), null, 'corrupt store');

    // Case and formatting tolerance: users will type lowercase or spaced.
    const relaxed = await consumeRecoveryCode(stored, codes[0].toLowerCase().replace('-', ' '));
    assert.ok(relaxed, 'normalization must match the hashed form');
  });
});

describe('signed login cookie', () => {
  const secret = generateSecretB32();

  it('round-trips a fresh cookie and rejects tampering', async () => {
    const value = await signAuthCookie(secret);
    assert.equal(await verifyAuthCookie(secret, value), true);
    const [expHex, sig] = value.split('.');
    const tamperedSig = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    assert.equal(await verifyAuthCookie(secret, `${expHex}.${tamperedSig}`), false, 'flipped sig bit');
    assert.equal(await verifyAuthCookie(generateSecretB32(), value), false, 'other secret');
    assert.equal(await verifyAuthCookie(secret, 'garbage'), false);
    assert.equal(await verifyAuthCookie(secret, ''), false);
    assert.equal(await verifyAuthCookie(secret, `${expHex}`), false);
  });

  it('expires after the TTL', async () => {
    const value = await signAuthCookie(secret);
    const [expHex] = value.split('.');
    const expiryMs = Number.parseInt(expHex, 16) * 1000;
    assert.equal(await verifyAuthCookie(secret, value, expiryMs + 1), false, 'just past expiry');
    assert.equal(await verifyAuthCookie(secret, value, expiryMs - 1_000), true, 'inside the window');
    assert.equal(AUTH_TTL_SECONDS, 12 * 60 * 60, 'cookie lifetime matches the room lifetime');
  });

  it('parses cookie headers and emits hardened attributes', () => {
    const header = 'other=1; ln_auth=abc.def ; third=x';
    assert.equal(parseCookieHeader(header, AUTH_COOKIE), 'abc.def');
    assert.equal(parseCookieHeader('nothing=here', AUTH_COOKIE), null);
    assert.equal(parseCookieHeader(null, AUTH_COOKIE), null);
    const setCookie = authCookieHeader('v');
    assert.match(setCookie, /^ln_auth=v;/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /Secure/);
    assert.match(setCookie, /SameSite=Strict/);
  });
});

describe('constant-time compare', () => {
  it('accepts equals and rejects differences of any length', () => {
    assert.equal(constantTimeEqual('abc', 'abc'), true);
    assert.equal(constantTimeEqual('abc', 'abd'), false);
    assert.equal(constantTimeEqual('abc', 'ab'), false);
    assert.equal(constantTimeEqual('ab', 'abc'), false);
    assert.equal(constantTimeEqual('', ''), true);
  });
});

describe('wiring contract', () => {
  it('the link socket gate blocks unauthenticated upgrades once login is confirmed', () => {
    assert.match(wsFn, /getSetting\(context\.env, 'totp_secret'\)/);
    assert.match(wsFn, /verifyAuthCookie\(totpSecret, raw\)/);
    assert.match(wsFn, /status: 401/);
  });

  it('the client checks room-scoped status before connecting and challenges with the typed code', () => {
    assert.match(indexJs, /async function ensureLinkAuth\(code\)/);
    assert.match(indexJs, /\/api\/auth\/status\$\{query\}/, 'status fetch must carry the room for the trust window');
    assert.match(indexJs, /status\.room_authed\)/, 'an open room trust window must skip the gate');
    assert.match(indexJs, /\/api\/auth\/challenge/);
    assert.match(indexJs, /async connect\(code\)/, 'connect must be async so the gate can await it');
    assert.match(indexJs, /if \(!\(await ensureLinkAuth\(code\)\)\)/);
  });

  it('the link modal ships the setup QR, confirm, and gate controls', () => {
    for (const id of [
      'linkAuthSection',
      'linkAuthSetup',
      'linkTotpSetupBtn',
      'linkTotpQrWrap',
      'linkTotpConfirmInput',
      'linkAuthGate',
      'linkAuthInput',
      'linkAuthBtn',
    ]) {
      assert.ok(indexHtml.includes(`id="${id}"`), `missing #${id}`);
    }
    // Both auth inputs are 6-digit TOTP codes, not free text.
    for (const id of ['linkTotpConfirmInput', 'linkAuthInput']) {
      const tag = indexHtml.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`));
      assert.ok(tag, `missing input #${id}`);
      assert.match(tag[0], /maxlength="6"/);
      assert.match(tag[0], /inputmode="numeric"/);
    }
  });
});
