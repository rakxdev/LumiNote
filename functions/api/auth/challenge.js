// /api/auth/challenge — exchange an authenticator token (or a one-time
// recovery code) for a signed login cookie. The link-mode socket gate and
// any other protected endpoint then accept the browser for 12 hours.
import {
  getSetting,
  putSetting,
  verifyTotp,
  consumeRecoveryCode,
  signAuthCookie,
  authCookieHeader,
} from './totp.js';

export async function onRequestPost({ env, request }) {
  if (!env.DB) {
    return Response.json({ error: 'Database binding not configured' }, { status: 500 });
  }
  const secretB32 = await getSetting(env, 'totp_secret');
  if (!secretB32 || (await getSetting(env, 'totp_confirmed')) !== '1') {
    return Response.json(
      { error: 'Authenticator login is not active' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let code = null;
  try {
    code = (await request.json())?.code;
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let via = null;
  let recoveryRemaining = null;
  if (verifyTotp(secretB32, code)) {
    via = 'totp';
  } else {
    const updated = await consumeRecoveryCode(await getSetting(env, 'totp_recovery'), code);
    if (updated !== null) {
      await putSetting(env, 'totp_recovery', JSON.stringify(updated));
      via = 'recovery';
      recoveryRemaining = updated.length;
    }
  }
  if (!via) {
    return Response.json(
      { error: 'Wrong code — check your authenticator' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const value = await signAuthCookie(secretB32);
  return Response.json(
    { ok: true, via, recovery_remaining: recoveryRemaining },
    { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': authCookieHeader(value) } }
  );
}
