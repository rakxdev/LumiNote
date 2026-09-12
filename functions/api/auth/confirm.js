// /api/auth/confirm — finish setup: the user scans the QR (or types the
// secret) and submits the current 6-digit token. On success the login is
// activated and 8 one-time recovery codes are returned exactly once; only
// their SHA-256 hashes are stored.
import { getSetting, putSetting, verifyTotp, generateRecoveryCodes, hashCode } from './totp.js';

export async function onRequestPost({ env, request }) {
  if (!env.DB) {
    return Response.json({ error: 'Database binding not configured' }, { status: 500 });
  }
  const secretB32 = await getSetting(env, 'totp_secret');
  if (!secretB32) {
    return Response.json({ error: 'Start the setup first' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if ((await getSetting(env, 'totp_confirmed')) === '1') {
    return Response.json({ error: 'Authenticator login is already active' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  let code = null;
  try {
    code = (await request.json())?.code;
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!verifyTotp(secretB32, code)) {
    return Response.json({ error: 'That code is not valid — check your authenticator' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const recoveryCodes = generateRecoveryCodes();
  const hashes = [];
  for (const rc of recoveryCodes) hashes.push(await hashCode(rc));
  await putSetting(env, 'totp_recovery', JSON.stringify(hashes));
  await putSetting(env, 'totp_confirmed', '1');

  return Response.json(
    { confirmed: true, recovery_codes: recoveryCodes },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
