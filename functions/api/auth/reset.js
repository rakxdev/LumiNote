// /api/auth/reset — erase the authenticator login so the user can re-enroll
// (new phone, switched authenticator app). Requires proof of possession: a
// current TOTP token or a still-valid recovery code. Without this the only
// recovery was a manual server-side wipe.
import {
  getSetting,
  verifyTotp,
  consumeRecoveryCode,
} from './totp.js';

export async function onRequestPost({ env, request }) {
  if (!env.DB) {
    return Response.json({ error: 'Database binding not configured' }, { status: 500 });
  }
  const secretB32 = await getSetting(env, 'totp_secret');
  if (!secretB32 || (await getSetting(env, 'totp_confirmed')) !== '1') {
    return Response.json({ error: 'Authenticator login is not active' }, {
      status: 404, headers: { 'Cache-Control': 'no-store' },
    });
  }

  let code = null;
  try {
    code = (await request.json())?.code;
  } catch {
    return Response.json({ error: 'body must be valid JSON' }, {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }

  let proven = verifyTotp(secretB32, code);
  if (!proven) {
    // A recovery code also proves possession; no need to burn it in the
    // store — success deletes the whole login row set anyway.
    proven = (await consumeRecoveryCode(await getSetting(env, 'totp_recovery'), code)) !== null;
  }
  if (!proven) {
    return Response.json({ error: 'Wrong code — check your authenticator' }, {
      status: 401, headers: { 'Cache-Control': 'no-store' },
    });
  }

  await env.DB.prepare(
    "DELETE FROM app_settings WHERE key IN ('totp_secret', 'totp_confirmed', 'totp_recovery')"
  ).run();
  return Response.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
