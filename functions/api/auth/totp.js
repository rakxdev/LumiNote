// TOTP login shared logic. Pure helpers are runtime-free so they unit-test
// in plain Node (mirroring the notes store module's style); the D1 access
// is a thin key/value layer over the app_settings table, which is why the
// worker stays untouched — only Pages Functions see env.DB.
import { TOTP, Secret } from 'otpauth';

export const AUTH_COOKIE = 'ln_auth';
export const AUTH_TTL_SECONDS = 12 * 60 * 60; // matches the room TTL
export const RECOVERY_CODE_COUNT = 8;

// --- app_settings key/value access (D1) ---
export async function getSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?1').bind(key).first();
  return row ? row.value : null;
}

export async function putSetting(env, key, value) {
  await env.DB.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2'
  ).bind(key, value).run();
}

// --- TOTP (RFC 6238, 6 digits / 30s, Google Authenticator compatible) ---
export function generateSecretB32() {
  return new Secret({ size: 20 }).base32;
}

export function buildTotp(secretB32) {
  return new TOTP({
    secret: Secret.fromBase32(secretB32),
    issuer: 'LumiNote',
    label: 'Studio',
    digits: 6,
    period: 30,
  });
}

// True when `code` is the current, previous, or next period token (±1 step
// of clock skew between devices).
export function verifyTotp(secretB32, code) {
  const clean = String(code ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  return buildTotp(secretB32).validate({ token: clean, window: 1 }) !== null;
}

// --- recovery codes: one-time codes stored as SHA-256 hashes ---
export function normalizeRecoveryCode(raw) {
  return String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const codes = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const chars = [...bytes].map((b) => alphabet[b % alphabet.length]);
    codes.push(`${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`);
  }
  return codes;
}

export async function hashCode(code) {
  const data = new TextEncoder().encode(normalizeRecoveryCode(code));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Marks `code` used inside a stored hash list. Returns the updated hash list
// with the matched hash removed, or null when the code does not match any.
export async function consumeRecoveryCode(storedHashesJson, code) {
  let hashes;
  try {
    hashes = JSON.parse(storedHashesJson || '[]');
  } catch {
    return null;
  }
  if (!Array.isArray(hashes) || hashes.length === 0) return null;
  const target = await hashCode(code);
  const idx = hashes.findIndex((h) => constantTimeEqual(h, target));
  if (idx === -1) return null;
  return hashes.filter((_, i) => i !== idx);
}

// --- signed login cookie ---
// The signing key is the TOTP secret itself: forging the cookie requires the
// same secret the authenticator holds, so no second server-side secret needs
// managing. Value is `<expiry-hex>.<hmac-hex>`.
async function hmacHex(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signAuthCookie(secretB32, nowMs = Date.now()) {
  const expiry = Math.floor(nowMs / 1000) + AUTH_TTL_SECONDS;
  const expHex = expiry.toString(16);
  return `${expHex}.${await hmacHex(secretB32, `${AUTH_COOKIE}:${expHex}`)}`;
}

export async function verifyAuthCookie(secretB32, cookieValue, nowMs = Date.now()) {
  const value = String(cookieValue ?? '');
  const dot = value.indexOf('.');
  if (dot <= 0) return false;
  const expHex = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expiry = Number.parseInt(expHex, 16);
  if (!Number.isFinite(expiry) || expiry * 1000 < nowMs) return false;
  const expected = await hmacHex(secretB32, `${AUTH_COOKIE}:${expHex}`);
  return constantTimeEqual(sig, expected);
}

export function parseCookieHeader(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function authCookieHeader(value) {
  return `${AUTH_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${AUTH_TTL_SECONDS}`;
}

// Length-independent comparison so early exits cannot leak timing.
export function constantTimeEqual(a, b) {
  const ab = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  const max = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < max; i++) {
    diff |= ab[i % ab.length] ^ bb[i % bb.length];
  }
  return diff === 0;
}
